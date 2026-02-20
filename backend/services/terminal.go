package services

import (
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
)

type TerminalService struct {
	sessions map[string]*TerminalSession
	mu       sync.RWMutex
}

type TerminalSession struct {
	PTY  *os.File
	Cmd  *exec.Cmd
	Done chan struct{}
}

func NewTerminalService() *TerminalService {
	return &TerminalService{
		sessions: make(map[string]*TerminalSession),
	}
}

func (s *TerminalService) Create(sessionKey string, workingDir string) (*TerminalSession, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Close existing session if any
	if existing, ok := s.sessions[sessionKey]; ok {
		existing.Close()
	}

	shell := os.Getenv("SHELL")
	if shell == "" {
		shell = "/bin/bash"
	}

	cmd := exec.Command(shell)
	cmd.Dir = workingDir
	cmd.Env = append(os.Environ(),
		"TERM=xterm-256color",
		"COLORTERM=truecolor",
	)

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}

	session := &TerminalSession{
		PTY:  ptmx,
		Cmd:  cmd,
		Done: make(chan struct{}),
	}

	// Monitor process exit
	go func() {
		cmd.Wait()
		close(session.Done)
	}()

	s.sessions[sessionKey] = session
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

	return pty.Setsize(session.PTY, &pty.Winsize{
		Rows: rows,
		Cols: cols,
	})
}

func (ts *TerminalSession) Close() {
	if ts.PTY != nil {
		ts.PTY.Close()
	}
	if ts.Cmd != nil && ts.Cmd.Process != nil {
		ts.Cmd.Process.Kill()
	}
}
