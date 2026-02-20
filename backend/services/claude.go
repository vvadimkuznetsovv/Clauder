package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"sync"
)

type ClaudeService struct {
	allowedTools string
	processes    map[string]*ClaudeProcess
	mu           sync.RWMutex
}

type ClaudeProcess struct {
	cmd    *exec.Cmd
	cancel context.CancelFunc
}

type ClaudeEvent struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data,omitempty"`
}

type StreamCallback func(line string)

func NewClaudeService(allowedTools string) *ClaudeService {
	return &ClaudeService{
		allowedTools: allowedTools,
		processes:    make(map[string]*ClaudeProcess),
	}
}

// SendMessage spawns a Claude Code CLI subprocess and streams output via callback
func (s *ClaudeService) SendMessage(
	ctx context.Context,
	sessionKey string,
	message string,
	workingDir string,
	claudeSessionID string,
	onLine StreamCallback,
) (string, error) {
	// Build command args
	args := []string{
		"-p", message,
		"--output-format", "stream-json",
		"--verbose",
	}

	if claudeSessionID != "" {
		args = append(args, "--resume", claudeSessionID)
	}

	if s.allowedTools != "" {
		args = append(args, "--allowedTools", s.allowedTools)
	}

	cmdCtx, cancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(cmdCtx, "claude", args...)
	cmd.Dir = workingDir

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return "", fmt.Errorf("failed to get stdout pipe: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return "", fmt.Errorf("failed to get stderr pipe: %w", err)
	}

	// Track process
	s.mu.Lock()
	s.processes[sessionKey] = &ClaudeProcess{cmd: cmd, cancel: cancel}
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.processes, sessionKey)
		s.mu.Unlock()
	}()

	if err := cmd.Start(); err != nil {
		cancel()
		return "", fmt.Errorf("failed to start claude: %w", err)
	}

	// Read stderr in background for error reporting
	var stderrOutput string
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			stderrOutput += scanner.Text() + "\n"
		}
	}()

	// Stream stdout line by line
	var lastSessionID string
	scanner := bufio.NewScanner(stdout)
	// Increase scanner buffer for large responses
	scanner.Buffer(make([]byte, 0, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		// Try to extract session_id from the output
		var event map[string]interface{}
		if err := json.Unmarshal([]byte(line), &event); err == nil {
			if sid, ok := event["session_id"].(string); ok && sid != "" {
				lastSessionID = sid
			}
		}

		onLine(line)
	}

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			return lastSessionID, ctx.Err()
		}
		return lastSessionID, fmt.Errorf("claude exited with error: %w, stderr: %s", err, stderrOutput)
	}

	return lastSessionID, nil
}

// Cancel stops a running Claude process
func (s *ClaudeService) Cancel(sessionKey string) {
	s.mu.RLock()
	proc, exists := s.processes[sessionKey]
	s.mu.RUnlock()

	if exists {
		proc.cancel()
	}
}

// IsRunning checks if a Claude process is active for a session
func (s *ClaudeService) IsRunning(sessionKey string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, exists := s.processes[sessionKey]
	return exists
}
