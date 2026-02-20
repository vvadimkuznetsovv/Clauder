package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"clauder/utils"
)

const testJWTSecret = "test-jwt-secret-for-middleware"

func setupAuthTestRouter(middlewareFunc gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(middlewareFunc)
	r.GET("/protected", func(c *gin.Context) {
		userID, _ := c.Get("user_id")
		username, _ := c.Get("username")
		c.JSON(http.StatusOK, gin.H{
			"user_id":  userID,
			"username": username,
		})
	})
	return r
}

func generateTestJWT(userID uuid.UUID, username string, partial bool, expiry time.Duration) string {
	token, err := utils.GenerateAccessToken(testJWTSecret, userID, username, partial, expiry)
	if err != nil {
		panic("failed to generate test JWT: " + err.Error())
	}
	return token
}

// --- AuthRequired tests ---

func TestAuthRequired_AllowsValidToken(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", false, 15*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestAuthRequired_RejectsMissingToken(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthRequired_RejectsMissingBearerPrefix(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", false, 15*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", token) // No "Bearer " prefix
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthRequired_RejectsInvalidToken(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer invalid.jwt.token")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthRequired_RejectsExpiredToken(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", false, -1*time.Second)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuthRequired_RejectsPartialToken(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", true, 15*time.Minute) // partial=true

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusForbidden, w.Code, "Partial tokens should be rejected by AuthRequired")
}

func TestAuthRequired_SetsUserContextValues(t *testing.T) {
	userID := uuid.New()
	username := "contextuser"

	var capturedUserID interface{}
	var capturedUsername interface{}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(AuthRequired(testJWTSecret))
	r.GET("/protected", func(c *gin.Context) {
		capturedUserID, _ = c.Get("user_id")
		capturedUsername, _ = c.Get("username")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	token := generateTestJWT(userID, username, false, 15*time.Minute)
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, userID, capturedUserID)
	assert.Equal(t, username, capturedUsername)
}

func TestAuthRequired_AcceptsTokenFromQueryParam(t *testing.T) {
	router := setupAuthTestRouter(AuthRequired(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "wsuser", false, 15*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected?token="+token, nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, "Should accept token from query parameter (WebSocket support)")
}

// --- PartialAuthAllowed tests ---

func TestPartialAuthAllowed_AllowsValidToken(t *testing.T) {
	router := setupAuthTestRouter(PartialAuthAllowed(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", false, 15*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestPartialAuthAllowed_AllowsPartialToken(t *testing.T) {
	router := setupAuthTestRouter(PartialAuthAllowed(testJWTSecret))
	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", true, 15*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, "PartialAuthAllowed should accept partial tokens")
}

func TestPartialAuthAllowed_RejectsMissingToken(t *testing.T) {
	router := setupAuthTestRouter(PartialAuthAllowed(testJWTSecret))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestPartialAuthAllowed_RejectsInvalidToken(t *testing.T) {
	router := setupAuthTestRouter(PartialAuthAllowed(testJWTSecret))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer garbage-token")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestPartialAuthAllowed_SetsPartialFlag(t *testing.T) {
	var capturedPartial interface{}

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(PartialAuthAllowed(testJWTSecret))
	r.GET("/protected", func(c *gin.Context) {
		capturedPartial, _ = c.Get("partial")
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	userID := uuid.New()
	token := generateTestJWT(userID, "testuser", true, 15*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, true, capturedPartial, "Partial flag should be set in context")
}
