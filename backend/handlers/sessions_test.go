package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"clauder/middleware"
	"clauder/models"
	"clauder/testutil"
)

func setupSessionsTestRouter() (*gin.Engine, *testutil.TestContext) {
	db := testutil.SetupTestDB()
	cfg := testutil.TestConfig()
	handler := NewSessionsHandler(cfg)

	gin.SetMode(gin.TestMode)
	r := gin.New()

	protected := r.Group("/api")
	protected.Use(middleware.AuthRequired(cfg.JWTSecret))
	{
		protected.GET("/sessions", handler.List)
		protected.POST("/sessions", handler.Create)
		protected.PUT("/sessions/:id", handler.Update)
		protected.DELETE("/sessions/:id", handler.Delete)
		protected.GET("/sessions/:id/messages", handler.Messages)
	}

	return r, &testutil.TestContext{DB: db, Cfg: cfg}
}

func TestSessions_Create(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	body, _ := json.Marshal(map[string]string{
		"title":             "Test Session",
		"working_directory": "/home/user/project",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/sessions", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "Test Session", resp["title"])
	assert.Equal(t, "/home/user/project", resp["working_directory"])
	assert.NotEmpty(t, resp["id"])
	assert.Equal(t, user.ID.String(), resp["user_id"])
}

func TestSessions_Create_DefaultTitle(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	// Send empty body - should default to "New Chat"
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/sessions", bytes.NewBufferString("{}"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "New Chat", resp["title"])
}

func TestSessions_Create_DefaultWorkingDirectory(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	body, _ := json.Marshal(map[string]string{
		"title": "My Session",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/api/sessions", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, tc.Cfg.ClaudeWorkingDir, resp["working_directory"],
		"Should default to config ClaudeWorkingDir when not specified")
}

func TestSessions_List(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	// Create some sessions directly in the DB
	for i := 0; i < 3; i++ {
		session := models.ChatSession{
			ID:               uuid.New(),
			UserID:           user.ID,
			Title:            "Session " + string(rune('A'+i)),
			WorkingDirectory: "/workspace",
		}
		tc.DB.Create(&session)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var sessions []map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &sessions)
	require.NoError(t, err)

	assert.Len(t, sessions, 3, "Should return all 3 sessions")
}

func TestSessions_List_OnlyReturnsOwnSessions(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	// Create a session for our user
	mySession := models.ChatSession{
		ID:               uuid.New(),
		UserID:           user.ID,
		Title:            "My Session",
		WorkingDirectory: "/workspace",
	}
	tc.DB.Create(&mySession)

	// Create a session for another user
	otherUserID := uuid.New()
	otherSession := models.ChatSession{
		ID:               uuid.New(),
		UserID:           otherUserID,
		Title:            "Other Session",
		WorkingDirectory: "/workspace",
	}
	tc.DB.Create(&otherSession)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/sessions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var sessions []map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &sessions)
	require.NoError(t, err)

	assert.Len(t, sessions, 1, "Should only return own sessions")
	assert.Equal(t, "My Session", sessions[0]["title"])
}

func TestSessions_Delete(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	session := models.ChatSession{
		ID:               uuid.New(),
		UserID:           user.ID,
		Title:            "Delete Me",
		WorkingDirectory: "/workspace",
	}
	tc.DB.Create(&session)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/sessions/"+session.ID.String(), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	// Verify the session is actually deleted
	var count int64
	tc.DB.Model(&models.ChatSession{}).Where("id = ?", session.ID).Count(&count)
	assert.Equal(t, int64(0), count, "Session should be deleted from database")
}

func TestSessions_Delete_NotFound(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/sessions/"+uuid.New().String(), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSessions_Delete_CannotDeleteOtherUsersSession(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	// Create a session owned by another user
	otherUserID := uuid.New()
	session := models.ChatSession{
		ID:               uuid.New(),
		UserID:           otherUserID,
		Title:            "Other User Session",
		WorkingDirectory: "/workspace",
	}
	tc.DB.Create(&session)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/api/sessions/"+session.ID.String(), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code, "Should not be able to delete another user's session")

	// Verify the session still exists
	var count int64
	tc.DB.Model(&models.ChatSession{}).Where("id = ?", session.ID).Count(&count)
	assert.Equal(t, int64(1), count, "Other user's session should still exist")
}

func TestSessions_Messages(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	session := models.ChatSession{
		ID:               uuid.New(),
		UserID:           user.ID,
		Title:            "Chat Session",
		WorkingDirectory: "/workspace",
	}
	tc.DB.Create(&session)

	// Create messages for this session
	messages := []models.Message{
		{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "user",
			Content:   "Hello",
		},
		{
			ID:        uuid.New(),
			SessionID: session.ID,
			Role:      "assistant",
			Content:   "Hi there!",
		},
	}
	for _, msg := range messages {
		tc.DB.Create(&msg)
	}

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/sessions/"+session.ID.String()+"/messages", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var respMessages []map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &respMessages)
	require.NoError(t, err)

	assert.Len(t, respMessages, 2, "Should return 2 messages")
	assert.Equal(t, "user", respMessages[0]["role"])
	assert.Equal(t, "Hello", respMessages[0]["content"])
	assert.Equal(t, "assistant", respMessages[1]["role"])
	assert.Equal(t, "Hi there!", respMessages[1]["content"])
}

func TestSessions_Messages_SessionNotFound(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/sessions/"+uuid.New().String()+"/messages", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestSessions_Messages_CannotAccessOtherUsersSession(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	otherUserID := uuid.New()
	session := models.ChatSession{
		ID:               uuid.New(),
		UserID:           otherUserID,
		Title:            "Other Session",
		WorkingDirectory: "/workspace",
	}
	tc.DB.Create(&session)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/sessions/"+session.ID.String()+"/messages", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code, "Should not access other user's session messages")
}

func TestSessions_Update(t *testing.T) {
	router, tc := setupSessionsTestRouter()
	user := testutil.CreateTestUser(tc.DB)
	token := testutil.GenerateTestToken(tc.Cfg, user.ID, user.Username, false)

	session := models.ChatSession{
		ID:               uuid.New(),
		UserID:           user.ID,
		Title:            "Old Title",
		WorkingDirectory: "/old/path",
	}
	tc.DB.Create(&session)

	body, _ := json.Marshal(map[string]string{
		"title":             "New Title",
		"working_directory": "/new/path",
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("PUT", "/api/sessions/"+session.ID.String(), bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &resp)
	require.NoError(t, err)

	assert.Equal(t, "New Title", resp["title"])
	assert.Equal(t, "/new/path", resp["working_directory"])
}

func TestSessions_RequiresAuth(t *testing.T) {
	router, _ := setupSessionsTestRouter()

	endpoints := []struct {
		method string
		url    string
	}{
		{"GET", "/api/sessions"},
		{"POST", "/api/sessions"},
		{"DELETE", "/api/sessions/" + uuid.New().String()},
		{"GET", "/api/sessions/" + uuid.New().String() + "/messages"},
	}

	for _, ep := range endpoints {
		t.Run(ep.method+" "+ep.url, func(t *testing.T) {
			w := httptest.NewRecorder()
			req, _ := http.NewRequest(ep.method, ep.url, nil)
			router.ServeHTTP(w, req)
			assert.Equal(t, http.StatusUnauthorized, w.Code, "%s %s should require auth", ep.method, ep.url)
		})
	}
}
