package handlers

import (
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"clauder/config"
	"clauder/services"
	"clauder/utils"
)

var termUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin:     func(r *http.Request) bool { return true },
}

type TerminalHandler struct {
	cfg      *config.Config
	terminal *services.TerminalService
}

func NewTerminalHandler(cfg *config.Config, terminal *services.TerminalService) *TerminalHandler {
	return &TerminalHandler{cfg: cfg, terminal: terminal}
}

type terminalMessage struct {
	Type string `json:"type"` // "input" | "resize"
	Data string `json:"data,omitempty"`
	Rows uint16 `json:"rows,omitempty"`
	Cols uint16 `json:"cols,omitempty"`
}

func (h *TerminalHandler) HandleWebSocket(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Token required"})
		return
	}

	claims, err := utils.ParseToken(h.cfg.JWTSecret, token)
	if err != nil || claims.Partial {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	instanceID := c.Query("instanceId")
	if instanceID == "" {
		instanceID = "default"
	}
	sessionKey := "term:" + claims.UserID.String() + ":" + instanceID

	log.Printf("[Terminal] NEW WS connection: remote=%s instanceId=%q sessionKey=%s",
		c.Request.RemoteAddr, instanceID, sessionKey)

	conn, err := termUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[Terminal] WS upgrade error: %v (key=%s)", err, sessionKey)
		return
	}
	defer func() {
		log.Printf("[Terminal] WS conn closed (defer): key=%s", sessionKey)
		conn.Close()
	}()

	// Reuse existing shell or create new one.
	// Shell lives independently of WebSocket — survives reconnections.
	log.Printf("[Terminal] calling GetOrCreate key=%s", sessionKey)
	termSession, err := h.terminal.GetOrCreate(sessionKey, h.cfg.ClaudeWorkingDir)
	if err != nil {
		log.Printf("[Terminal] failed to create session: %v (key=%s)", err, sessionKey)
		conn.WriteMessage(websocket.TextMessage, []byte(`{"type":"error","message":"Failed to create terminal"}`))
		return
	}

	// Close previous WebSocket (if any) so only one reader is active.
	// Old PTY→WS goroutine will fail on WriteMessage and stop.
	log.Printf("[Terminal] calling Attach key=%s", sessionKey)
	termSession.Attach(conn)
	log.Printf("[Terminal] Attach done, starting PTY→WS goroutine key=%s", sessionKey)

	// PTY → WebSocket (stdout)
	go func() {
		log.Printf("[Terminal] PTY→WS goroutine START key=%s", sessionKey)
		buf := make([]byte, 4096)
		for {
			n, err := termSession.Pty.Read(buf)
			if err != nil {
				if err != io.EOF {
					log.Printf("[Terminal] PTY read error: %v (key=%s)", err, sessionKey)
				} else {
					log.Printf("[Terminal] PTY EOF (shell exited) key=%s", sessionKey)
				}
				conn.WriteMessage(websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, "Shell exited"))
				log.Printf("[Terminal] PTY→WS goroutine STOP (PTY read err) key=%s", sessionKey)
				return
			}
			if err := conn.WriteMessage(websocket.BinaryMessage, buf[:n]); err != nil {
				log.Printf("[Terminal] PTY→WS goroutine STOP (WS write err: %v) key=%s", err, sessionKey)
				return // WS closed (reconnection or tab closed) — stop reading
			}
		}
	}()

	log.Printf("[Terminal] WS→PTY loop START key=%s", sessionKey)
	// WebSocket → PTY (stdin)
	for {
		msgType, raw, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[Terminal] WS→PTY loop STOP (read err: %v) key=%s", err, sessionKey)
			break
		}

		if msgType == websocket.BinaryMessage {
			// Raw terminal input
			termSession.Pty.Write(raw)
			continue
		}

		// JSON control messages
		var msg terminalMessage
		if err := json.Unmarshal(raw, &msg); err != nil {
			log.Printf("[Terminal] JSON unmarshal error: %v (key=%s)", err, sessionKey)
			continue
		}

		log.Printf("[Terminal] control msg type=%s (key=%s)", msg.Type, sessionKey)
		switch msg.Type {
		case "input":
			termSession.Pty.Write([]byte(msg.Data))
		case "resize":
			log.Printf("[Terminal] resize rows=%d cols=%d key=%s", msg.Rows, msg.Cols, sessionKey)
			h.terminal.Resize(sessionKey, msg.Rows, msg.Cols)
		}
	}

	log.Printf("[Terminal] handler EXIT key=%s", sessionKey)
	// Session stays alive — shell persists for reconnection.
	// Only killed when shell exits or Create is called explicitly.
}
