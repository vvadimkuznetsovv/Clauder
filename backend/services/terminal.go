package services

import (
	"io"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync"

	gopty "github.com/aymanbagabas/go-pty"
)

type TerminalService struct {
	sessions map[string]*TerminalSession
	mu       sync.RWMutex
}

type TerminalSession struct {
	Pty  gopty.Pty
	Cmd  *gopty.Cmd
	Done chan struct{}

	// connMu guards active — the currently attached WebSocket.
	// When a new WS attaches, the old one is closed so its goroutines stop
	// and the new WS becomes the sole reader/writer.
	connMu sync.Mutex
	active io.Closer
}

func NewTerminalService() *TerminalService {
	return &TerminalService{
		sessions: make(map[string]*TerminalSession),
	}
}

func defaultShell() string {
	if runtime.GOOS == "windows" {
		// On Windows, ignore $SHELL — it's set by Git Bash/MINGW to a Unix-style
		// path (e.g. /usr/bin/bash) that ConPTY cannot execute.
		// Must resolve absolute path — go-pty resolves relative to cmd.Dir on Windows.
		if ps, err := exec.LookPath("pwsh.exe"); err == nil {
			return ps
		}
		if ps, err := exec.LookPath("powershell.exe"); err == nil {
			return ps
		}
		return "powershell.exe"
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	// Try bash first, then ash (Alpine default), then sh
	for _, sh := range []string{"bash", "ash", "sh"} {
		if p, err := exec.LookPath(sh); err == nil {
			return p
		}
	}
	return "/bin/sh"
}

// GetOrCreate returns an existing alive session or creates a new one.
func (s *TerminalService) GetOrCreate(sessionKey string, workingDir string) (*TerminalSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	log.Printf("[TerminalService] GetOrCreate key=%s totalSessions=%d", sessionKey, len(s.sessions))

	// Reuse existing session if shell is still running
	if existing, ok := s.sessions[sessionKey]; ok {
		alive := existing.IsAlive()
		log.Printf("[TerminalService] found existing session key=%s alive=%v", sessionKey, alive)
		if alive {
			return existing, nil
		}
		// Shell is dead — clean up
		log.Printf("[TerminalService] dead session, recreating key=%s", sessionKey)
		existing.Close()
		delete(s.sessions, sessionKey)
	} else {
		log.Printf("[TerminalService] no existing session, creating new key=%s", sessionKey)
	}

	return s.createLocked(sessionKey, workingDir)
}

// Create always creates a new session, closing any existing one.
func (s *TerminalService) Create(sessionKey string, workingDir string) (*TerminalSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if existing, ok := s.sessions[sessionKey]; ok {
		existing.Close()
		delete(s.sessions, sessionKey)
	}

	return s.createLocked(sessionKey, workingDir)
}

func (s *TerminalService) createLocked(sessionKey string, workingDir string) (*TerminalSession, error) {
	shell := defaultShell()
	log.Printf("[TerminalService] createLocked shell=%s dir=%s key=%s", shell, workingDir, sessionKey)

	// Verify working directory exists, fall back to /tmp
	if _, err := os.Stat(workingDir); err != nil {
		log.Printf("Terminal: dir %s not found, fallback /tmp", workingDir)
		workingDir = os.TempDir()
	}

	p, err := gopty.New()
	if err != nil {
		return nil, err
	}

	cmd := p.Command(shell)
	cmd.Dir = workingDir

	// Build environment: ensure critical vars exist for shell init
	env := os.Environ()
	has := make(map[string]bool)
	for _, e := range env {
		if i := strings.IndexByte(e, '='); i > 0 {
			has[e[:i]] = true
		}
	}
	if !has["HOME"] {
		env = append(env, "HOME="+workingDir)
	}
	if !has["USER"] {
		env = append(env, "USER=root")
	}
	if !has["SHELL"] {
		env = append(env, "SHELL="+shell)
	}
	if !has["PATH"] {
		env = append(env, "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
	}
	env = append(env, "TERM=xterm-256color", "COLORTERM=truecolor")
	cmd.Env = env

	if err := cmd.Start(); err != nil {
		p.Close()
		log.Printf("[TerminalService] cmd.Start failed: %v key=%s", err, sessionKey)
		return nil, err
	}

	session := &TerminalSession{
		Pty:  p,
		Cmd:  cmd,
		Done: make(chan struct{}),
	}

	log.Printf("[TerminalService] shell started pid=%d key=%s", cmd.Process.Pid, sessionKey)

	// Monitor process exit
	go func() {
		if err := cmd.Wait(); err != nil {
			log.Printf("[TerminalService] shell exited with error: %v (key=%s)", err, sessionKey)
		} else {
			log.Printf("[TerminalService] shell exited normally (key=%s)", sessionKey)
		}
		close(session.Done)
	}()

	s.sessions[sessionKey] = session
	log.Printf("[TerminalService] session stored key=%s totalSessions=%d", sessionKey, len(s.sessions))
	return session, nil
}

func (s *TerminalService) Get(sessionKey string) (*TerminalSession, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	session, ok := s.sessions[sessionKey]
	return session, ok
}

func (s *TerminalService) Remove(sessionKey string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if session, ok := s.sessions[sessionKey]; ok {
		session.Close()
		delete(s.sessions, sessionKey)
	}
}

func (s *TerminalService) Resize(sessionKey string, rows, cols uint16) error {
	s.mu.RLock()
	session, ok := s.sessions[sessionKey]
	s.mu.RUnlock()

	if !ok {
		return nil
	}

	return session.Pty.Resize(int(cols), int(rows))
}

// IsAlive returns true if the shell process is still running.
func (ts *TerminalSession) IsAlive() bool {
	select {
	case <-ts.Done:
		return false
	default:
		return true
	}
}

// Attach sets this conn as the active WebSocket, closing the previous one.
// This ensures only one PTY→WS reader goroutine is active at a time.
func (ts *TerminalSession) Attach(c io.Closer) {
	ts.connMu.Lock()
	old := ts.active
	ts.active = c
	ts.connMu.Unlock()
	if old != nil {
		log.Printf("[TerminalService] Attach: closing OLD conn %p, installing NEW conn %p", old, c)
		old.Close()
	} else {
		log.Printf("[TerminalService] Attach: no old conn, installing NEW conn %p", c)
	}
}

func (ts *TerminalSession) Close() {
	if ts.Pty != nil {
		ts.Pty.Close()
	}
	if ts.Cmd != nil && ts.Cmd.Process != nil {
		ts.Cmd.Process.Kill()
	}
}
