package handlers

import (
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"

	"clauder/config"
)

type FilesHandler struct {
	cfg *config.Config
}

func NewFilesHandler(cfg *config.Config) *FilesHandler {
	return &FilesHandler{cfg: cfg}
}

type FileInfo struct {
	Name    string `json:"name"`
	Path    string `json:"path"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

type writeFileRequest struct {
	Path    string `json:"path" binding:"required"`
	Content string `json:"content" binding:"required"`
}

func (h *FilesHandler) List(c *gin.Context) {
	requestedPath := c.Query("path")
	if requestedPath == "" {
		requestedPath = h.cfg.ClaudeWorkingDir
	}

	fullPath, err := h.safePath(requestedPath)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	entries, err := os.ReadDir(fullPath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Directory not found"})
		return
	}

	files := make([]FileInfo, 0, len(entries))
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		// Skip hidden files starting with .
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		files = append(files, FileInfo{
			Name:    entry.Name(),
			Path:    filepath.Join(requestedPath, entry.Name()),
			IsDir:   entry.IsDir(),
			Size:    info.Size(),
			ModTime: info.ModTime().Format("2006-01-02 15:04:05"),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"path":  requestedPath,
		"files": files,
	})
}

func (h *FilesHandler) Read(c *gin.Context) {
	requestedPath := c.Query("path")
	if requestedPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path required"})
		return
	}

	fullPath, err := h.safePath(requestedPath)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	// Limit file size to 5MB
	if info.Size() > 5*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "File too large (max 5MB)"})
		return
	}

	content, err := os.ReadFile(fullPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"path":    requestedPath,
		"content": string(content),
		"size":    info.Size(),
	})
}

func (h *FilesHandler) Write(c *gin.Context) {
	var req writeFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	fullPath, err := h.safePath(req.Path)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, fs.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create directory"})
		return
	}

	if err := os.WriteFile(fullPath, []byte(req.Content), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "File saved", "path": req.Path})
}

func (h *FilesHandler) Delete(c *gin.Context) {
	requestedPath := c.Query("path")
	if requestedPath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Path required"})
		return
	}

	fullPath, err := h.safePath(requestedPath)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	if err := os.RemoveAll(fullPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted", "path": requestedPath})
}

// safePath ensures the requested path is within the allowed working directory
func (h *FilesHandler) safePath(requestedPath string) (string, error) {
	// Clean and resolve the path
	cleaned := filepath.Clean(requestedPath)

	// If it's a relative path, join with working dir
	if !filepath.IsAbs(cleaned) {
		cleaned = filepath.Join(h.cfg.ClaudeWorkingDir, cleaned)
	}

	// Resolve to absolute
	absPath, err := filepath.Abs(cleaned)
	if err != nil {
		return "", err
	}

	// Ensure it's within allowed directory
	allowedBase, err := filepath.Abs(h.cfg.ClaudeWorkingDir)
	if err != nil {
		return "", err
	}

	if !strings.HasPrefix(absPath, allowedBase) {
		return "", fs.ErrPermission
	}

	return absPath, nil
}
