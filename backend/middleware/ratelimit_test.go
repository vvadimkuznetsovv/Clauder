package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupRateLimitRouter(limit int, window time.Duration) *gin.Engine {
	r := gin.New()
	rl := NewRateLimiter(limit, window)
	r.Use(rl.Middleware())
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	return r
}

func TestRateLimiter_AllowsRequestsWithinLimit(t *testing.T) {
	router := setupRateLimitRouter(5, 1*time.Minute)

	for i := 0; i < 5; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code, "Request %d should be allowed", i+1)
	}
}

func TestRateLimiter_BlocksRequestsOverLimit(t *testing.T) {
	limit := 3
	router := setupRateLimitRouter(limit, 1*time.Minute)

	// Use up all allowed requests
	for i := 0; i < limit; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.2:12345"
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Request %d should be allowed", i+1)
	}

	// Next request should be blocked
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.2:12345"
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code, "Request beyond limit should be blocked")
}

func TestRateLimiter_ResetsAfterWindowExpires(t *testing.T) {
	window := 100 * time.Millisecond
	limit := 2
	router := setupRateLimitRouter(limit, window)

	// Use up all requests
	for i := 0; i < limit; i++ {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/test", nil)
		req.RemoteAddr = "192.168.1.3:12345"
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Should be blocked now
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.3:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	// Wait for window to expire
	time.Sleep(window + 50*time.Millisecond)

	// Should be allowed again
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.3:12345"
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code, "Request should be allowed after window reset")
}

func TestRateLimiter_DifferentIPsHaveSeparateLimits(t *testing.T) {
	limit := 1
	router := setupRateLimitRouter(limit, 1*time.Minute)

	// First IP: use its limit
	w1 := httptest.NewRecorder()
	req1, _ := http.NewRequest("GET", "/test", nil)
	req1.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w1, req1)
	assert.Equal(t, http.StatusOK, w1.Code)

	// First IP: should now be blocked
	w1b := httptest.NewRecorder()
	req1b, _ := http.NewRequest("GET", "/test", nil)
	req1b.RemoteAddr = "10.0.0.1:12345"
	router.ServeHTTP(w1b, req1b)
	assert.Equal(t, http.StatusTooManyRequests, w1b.Code)

	// Second IP: should still be allowed
	w2 := httptest.NewRecorder()
	req2, _ := http.NewRequest("GET", "/test", nil)
	req2.RemoteAddr = "10.0.0.2:12345"
	router.ServeHTTP(w2, req2)
	assert.Equal(t, http.StatusOK, w2.Code, "Different IP should have its own rate limit")
}

func TestRateLimiter_FirstRequestAlwaysAllowed(t *testing.T) {
	router := setupRateLimitRouter(1, 1*time.Minute)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "172.16.0.1:12345"
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code, "The very first request should always be allowed")
}
