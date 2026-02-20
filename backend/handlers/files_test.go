package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"clauder/middleware"
	"clauder/models"
	"clauder/testutil"
)

type filesTestEnv struct {
	Router  *gin.Engine
	Token   string
	WorkDir string
	User    models.User
}

func setupFilesTest(t *testing.T) *filesTestEnv {
	t.Helper()

	workDir, err := os.MkdirTemp("", "clauder-test-files-*")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(workDir) })

	db := testutil.SetupTestDB()
	cfg := testutil.TestConfig()
	cfg.ClaudeWorkingDir = workDir

	user := testutil.CreateTestUser(db)
	token := testutil.GenerateTestToken(cfg, user.ID, user.Username, false)

	handler := NewFilesHandler(cfg)

	gin.SetMode(gin.TestMode)
	r := gin.New()

	protected := r.Group("/api")
	protected.Use(middleware.AuthRequired(cfg.JWTSecret))
	{
		protected.GET("/files", handler.List)
		protected.GET("/files/read", handler.Read)
		protected.PUT("/files/write", handler.Write)
		protected.DELETE("/files", handler.Delete)
	}

	return &filesTestEnv{
		Router:  r,
		Token:   token,
		WorkDir: workDir,
		User:    user,
	}
}

func (e *filesTestEnv) doRequest(method, url string, body []byte) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	var req *http.Request
	if body != nil {
		req, _ = http.NewRequest(method, url, bytes.NewBuffer(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req, _ = http.NewRequest(method, url, nil)
	}
	req.Header.Set("Authorization", "Bearer "+e.Token)
	e.Router.ServeHTTP(w, req)
	return w
}

func TestFiles_List_ReturnsFilesInDirectory(t *testing.T) {
	env := setupFilesTest(t)

	// Create some test files
	require.NoError(t, os.WriteFile(filepath.Join(env.WorkDir, "file1.txt"), []byte("content1"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(env.WorkDir, "file2.go"), []byte("package main"), 0644))
	require.NoError(t, os.Mkdir(filepath.Join(env.WorkDir, "subdir"), 0755))

	w := env.doRequest("GET", "/api/files?path="+env.WorkDir, nil)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	files, ok := resp["files"].([]interface{})
	require.True(t, ok)
	assert.Len(t, files, 3, "Should list 3 items (2 files + 1 directory)")

	// Check that files have the expected structure
	for _, f := range files {
		fileMap, ok := f.(map[string]interface{})
		require.True(t, ok)
		assert.NotEmpty(t, fileMap["name"])
		assert.NotEmpty(t, fileMap["path"])
		assert.Contains(t, fileMap, "is_dir")
		assert.Contains(t, fileMap, "size")
		assert.Contains(t, fileMap, "mod_time")
	}
}

func TestFiles_List_DefaultsToWorkingDir(t *testing.T) {
	env := setupFilesTest(t)

	require.NoError(t, os.WriteFile(filepath.Join(env.WorkDir, "default.txt"), []byte("hi"), 0644))

	w := env.doRequest("GET", "/api/files", nil) // No path param

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	files, ok := resp["files"].([]interface{})
	require.True(t, ok)
	assert.Len(t, files, 1)
}

func TestFiles_List_HidesHiddenFiles(t *testing.T) {
	env := setupFilesTest(t)

	require.NoError(t, os.WriteFile(filepath.Join(env.WorkDir, ".hidden"), []byte("secret"), 0644))
	require.NoError(t, os.WriteFile(filepath.Join(env.WorkDir, "visible.txt"), []byte("hello"), 0644))

	w := env.doRequest("GET", "/api/files?path="+env.WorkDir, nil)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	files := resp["files"].([]interface{})
	assert.Len(t, files, 1, "Hidden files should not be listed")

	fileMap := files[0].(map[string]interface{})
	assert.Equal(t, "visible.txt", fileMap["name"])
}

func TestFiles_Read_ReturnsFileContent(t *testing.T) {
	env := setupFilesTest(t)

	expectedContent := "Hello, World!\nLine 2"
	filePath := filepath.Join(env.WorkDir, "readme.txt")
	require.NoError(t, os.WriteFile(filePath, []byte(expectedContent), 0644))

	w := env.doRequest("GET", "/api/files/read?path="+filePath, nil)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, expectedContent, resp["content"])
	assert.Equal(t, filePath, resp["path"])
}

func TestFiles_Read_FileNotFound(t *testing.T) {
	env := setupFilesTest(t)

	w := env.doRequest("GET", "/api/files/read?path="+filepath.Join(env.WorkDir, "nonexistent.txt"), nil)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestFiles_Read_MissingPath(t *testing.T) {
	env := setupFilesTest(t)

	w := env.doRequest("GET", "/api/files/read", nil) // No path param

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestFiles_Write_CreatesNewFile(t *testing.T) {
	env := setupFilesTest(t)

	filePath := filepath.Join(env.WorkDir, "newfile.txt")
	content := "Brand new file content"

	body, _ := json.Marshal(map[string]string{
		"path":    filePath,
		"content": content,
	})

	w := env.doRequest("PUT", "/api/files/write", body)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify the file was actually created
	readContent, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Equal(t, content, string(readContent))
}

func TestFiles_Write_UpdatesExistingFile(t *testing.T) {
	env := setupFilesTest(t)

	filePath := filepath.Join(env.WorkDir, "existing.txt")
	require.NoError(t, os.WriteFile(filePath, []byte("original"), 0644))

	updatedContent := "updated content"
	body, _ := json.Marshal(map[string]string{
		"path":    filePath,
		"content": updatedContent,
	})

	w := env.doRequest("PUT", "/api/files/write", body)

	assert.Equal(t, http.StatusOK, w.Code)

	readContent, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Equal(t, updatedContent, string(readContent))
}

func TestFiles_Write_CreatesNestedDirectories(t *testing.T) {
	env := setupFilesTest(t)

	filePath := filepath.Join(env.WorkDir, "deep", "nested", "dir", "file.txt")
	body, _ := json.Marshal(map[string]string{
		"path":    filePath,
		"content": "nested content",
	})

	w := env.doRequest("PUT", "/api/files/write", body)

	assert.Equal(t, http.StatusOK, w.Code)

	readContent, err := os.ReadFile(filePath)
	require.NoError(t, err)
	assert.Equal(t, "nested content", string(readContent))
}

func TestFiles_Delete_RemovesFile(t *testing.T) {
	env := setupFilesTest(t)

	filePath := filepath.Join(env.WorkDir, "deleteme.txt")
	require.NoError(t, os.WriteFile(filePath, []byte("goodbye"), 0644))

	w := env.doRequest("DELETE", "/api/files?path="+filePath, nil)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify file is actually deleted
	_, err := os.Stat(filePath)
	assert.True(t, os.IsNotExist(err), "File should be deleted")
}

func TestFiles_Delete_MissingPath(t *testing.T) {
	env := setupFilesTest(t)

	w := env.doRequest("DELETE", "/api/files", nil) // No path param

	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestFiles_PathTraversal_DotDot(t *testing.T) {
	env := setupFilesTest(t)

	// Attempt to read outside the working directory using ../
	traversalPath := filepath.Join(env.WorkDir, "..", "..", "etc", "passwd")

	w := env.doRequest("GET", "/api/files/read?path="+traversalPath, nil)

	assert.Equal(t, http.StatusForbidden, w.Code, "Path traversal should be blocked")
}

func TestFiles_PathTraversal_AbsolutePath(t *testing.T) {
	env := setupFilesTest(t)

	// Attempt to access an absolute path outside working dir
	var outsidePath string
	if os.PathSeparator == '\\' {
		outsidePath = "C:\\Windows\\System32\\drivers\\etc\\hosts"
	} else {
		outsidePath = "/etc/passwd"
	}

	w := env.doRequest("GET", "/api/files/read?path="+outsidePath, nil)

	assert.Equal(t, http.StatusForbidden, w.Code, "Accessing absolute paths outside working dir should be blocked")
}

func TestFiles_PathTraversal_WriteOutsideWorkDir(t *testing.T) {
	env := setupFilesTest(t)

	traversalPath := filepath.Join(env.WorkDir, "..", "evil.txt")
	body, _ := json.Marshal(map[string]string{
		"path":    traversalPath,
		"content": "malicious content",
	})

	w := env.doRequest("PUT", "/api/files/write", body)

	assert.Equal(t, http.StatusForbidden, w.Code, "Writing outside working dir should be blocked")
}

func TestFiles_PathTraversal_DeleteOutsideWorkDir(t *testing.T) {
	env := setupFilesTest(t)

	traversalPath := filepath.Join(env.WorkDir, "..", "something")

	w := env.doRequest("DELETE", "/api/files?path="+traversalPath, nil)

	assert.Equal(t, http.StatusForbidden, w.Code, "Deleting outside working dir should be blocked")
}

func TestFiles_PathTraversal_ListOutsideWorkDir(t *testing.T) {
	env := setupFilesTest(t)

	traversalPath := filepath.Join(env.WorkDir, "..")

	w := env.doRequest("GET", "/api/files?path="+traversalPath, nil)

	assert.Equal(t, http.StatusForbidden, w.Code, "Listing outside working dir should be blocked")
}
