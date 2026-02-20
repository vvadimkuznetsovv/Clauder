package testutil

import (
	"fmt"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"clauder/config"
	"clauder/database"
	"clauder/middleware"
	"clauder/models"
	"clauder/utils"
)

var dbCounter atomic.Int64

const (
	TestUsername = "testuser"
	TestPassword = "testpassword123"
	TestJWTSecret = "test-jwt-secret-key-for-testing"
)

// SetupTestDB creates an in-memory SQLite database with all migrations applied.
// It also sets the global database.DB variable so handlers can use it.
func SetupTestDB() *gorm.DB {
	// Use a unique DSN for each test to avoid data leaking between tests
	n := dbCounter.Add(1)
	dsn := fmt.Sprintf("file:memdb%d?mode=memory&cache=shared", n)
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		panic("failed to connect to test database: " + err.Error())
	}

	// Run migrations
	err = db.AutoMigrate(
		&models.User{},
		&models.ChatSession{},
		&models.Message{},
		&models.RefreshToken{},
	)
	if err != nil {
		panic("failed to run migrations: " + err.Error())
	}

	// Set the global DB variable used by handlers
	database.DB = db

	return db
}

// TestConfig returns a Config suitable for testing.
func TestConfig() *config.Config {
	return &config.Config{
		Port:               "8080",
		JWTSecret:          TestJWTSecret,
		JWTExpiry:          15 * time.Minute,
		JWTRefreshExpiry:   168 * time.Hour,
		ClaudeAllowedTools: "Read,Write",
		ClaudeWorkingDir:   "/tmp/clauder-test",
		AdminUsername:      "admin",
		AdminPassword:      "admin123",
	}
}

// SetupTestRouter creates a Gin router in test mode with auth middleware configured.
func SetupTestRouter(cfg *config.Config) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	return r
}

// CreateTestUser creates a user in the test database with known credentials.
// Returns the created user.
func CreateTestUser(db *gorm.DB) models.User {
	hash, err := bcrypt.GenerateFromPassword([]byte(TestPassword), bcrypt.MinCost)
	if err != nil {
		panic("failed to hash password: " + err.Error())
	}

	user := models.User{
		ID:           uuid.New(),
		Username:     TestUsername,
		PasswordHash: string(hash),
		TOTPEnabled:  false,
	}

	if err := db.Create(&user).Error; err != nil {
		panic("failed to create test user: " + err.Error())
	}

	return user
}

// CreateTestUserWithTOTP creates a user with TOTP enabled and a known secret.
// Returns the user and the TOTP secret.
func CreateTestUserWithTOTP(db *gorm.DB, totpSecret string) models.User {
	hash, err := bcrypt.GenerateFromPassword([]byte(TestPassword), bcrypt.MinCost)
	if err != nil {
		panic("failed to hash password: " + err.Error())
	}

	user := models.User{
		ID:           uuid.New(),
		Username:     "totpuser",
		PasswordHash: string(hash),
		TOTPEnabled:  true,
		TOTPSecret:   totpSecret,
	}

	if err := db.Create(&user).Error; err != nil {
		panic("failed to create test user with TOTP: " + err.Error())
	}

	return user
}

// GenerateTestToken generates a JWT token for testing purposes.
func GenerateTestToken(cfg *config.Config, userID uuid.UUID, username string, partial bool) string {
	token, err := utils.GenerateAccessToken(cfg.JWTSecret, userID, username, partial, cfg.JWTExpiry)
	if err != nil {
		panic("failed to generate test token: " + err.Error())
	}
	return token
}

// TestContext holds references to the test database and config for convenience.
type TestContext struct {
	DB  *gorm.DB
	Cfg *config.Config
}

// AuthProtectedGroup returns a router group with AuthRequired middleware applied.
func AuthProtectedGroup(r *gin.Engine, cfg *config.Config) *gin.RouterGroup {
	group := r.Group("/api")
	group.Use(middleware.AuthRequired(cfg.JWTSecret))
	return group
}

// PartialAuthGroup returns a router group with PartialAuthAllowed middleware applied.
func PartialAuthGroup(r *gin.Engine, cfg *config.Config) *gin.RouterGroup {
	group := r.Group("/api")
	group.Use(middleware.PartialAuthAllowed(cfg.JWTSecret))
	return group
}
