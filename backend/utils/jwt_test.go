package utils

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const testSecret = "test-secret-key-for-jwt-testing"

func TestGenerateAccessToken_CreatesValidToken(t *testing.T) {
	userID := uuid.New()
	username := "testuser"

	token, err := GenerateAccessToken(testSecret, userID, username, false, 15*time.Minute)

	require.NoError(t, err)
	assert.NotEmpty(t, token)

	// Parse it back and verify claims
	claims, err := ParseToken(testSecret, token)
	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, username, claims.Username)
	assert.False(t, claims.Partial)
	assert.NotEmpty(t, claims.ID)
	assert.NotNil(t, claims.ExpiresAt)
	assert.NotNil(t, claims.IssuedAt)
}

func TestGenerateAccessToken_PartialFlag(t *testing.T) {
	userID := uuid.New()

	// Generate a partial token (TOTP not yet verified)
	token, err := GenerateAccessToken(testSecret, userID, "user", true, 5*time.Minute)
	require.NoError(t, err)

	claims, err := ParseToken(testSecret, token)
	require.NoError(t, err)
	assert.True(t, claims.Partial, "Partial flag should be true")
}

func TestGenerateAccessToken_NonPartialFlag(t *testing.T) {
	userID := uuid.New()

	token, err := GenerateAccessToken(testSecret, userID, "user", false, 15*time.Minute)
	require.NoError(t, err)

	claims, err := ParseToken(testSecret, token)
	require.NoError(t, err)
	assert.False(t, claims.Partial, "Partial flag should be false")
}

func TestParseToken_ValidToken(t *testing.T) {
	userID := uuid.New()
	username := "parsetest"

	token, err := GenerateAccessToken(testSecret, userID, username, false, 15*time.Minute)
	require.NoError(t, err)

	claims, err := ParseToken(testSecret, token)

	require.NoError(t, err)
	assert.Equal(t, userID, claims.UserID)
	assert.Equal(t, username, claims.Username)
	assert.False(t, claims.Partial)
}

func TestParseToken_ExpiredToken(t *testing.T) {
	userID := uuid.New()

	// Generate a token that expires immediately (negative duration)
	token, err := GenerateAccessToken(testSecret, userID, "expired", false, -1*time.Second)
	require.NoError(t, err)

	// Wait a moment to make sure it is expired
	time.Sleep(10 * time.Millisecond)

	_, err = ParseToken(testSecret, token)
	assert.Error(t, err, "Parsing expired token should return an error")
}

func TestParseToken_WrongSecret(t *testing.T) {
	userID := uuid.New()

	token, err := GenerateAccessToken(testSecret, userID, "wrongsecret", false, 15*time.Minute)
	require.NoError(t, err)

	_, err = ParseToken("completely-different-secret", token)
	assert.Error(t, err, "Parsing with wrong secret should return an error")
}

func TestParseToken_MalformedToken(t *testing.T) {
	_, err := ParseToken(testSecret, "this.is.not.a.valid.jwt")
	assert.Error(t, err, "Parsing a malformed token should return an error")
}

func TestParseToken_EmptyToken(t *testing.T) {
	_, err := ParseToken(testSecret, "")
	assert.Error(t, err, "Parsing an empty token should return an error")
}

func TestGenerateRefreshToken_ReturnsUniqueTokens(t *testing.T) {
	token1, hash1, err1 := GenerateRefreshToken()
	require.NoError(t, err1)

	token2, hash2, err2 := GenerateRefreshToken()
	require.NoError(t, err2)

	assert.NotEmpty(t, token1)
	assert.NotEmpty(t, hash1)
	assert.NotEmpty(t, token2)
	assert.NotEmpty(t, hash2)

	assert.NotEqual(t, token1, token2, "Two generated tokens should be different")
	assert.NotEqual(t, hash1, hash2, "Hashes of different tokens should be different")
}

func TestGenerateRefreshToken_HashMatchesToken(t *testing.T) {
	token, hash, err := GenerateRefreshToken()
	require.NoError(t, err)

	// Verify the hash matches what HashToken produces
	expectedHash := HashToken(token)
	assert.Equal(t, expectedHash, hash, "Hash returned by GenerateRefreshToken should match HashToken output")
}

func TestHashToken_Deterministic(t *testing.T) {
	input := "some-refresh-token-value"

	hash1 := HashToken(input)
	hash2 := HashToken(input)

	assert.Equal(t, hash1, hash2, "HashToken should return the same hash for the same input")
	assert.NotEmpty(t, hash1)
}

func TestHashToken_DifferentInputsDifferentHashes(t *testing.T) {
	hash1 := HashToken("token-a")
	hash2 := HashToken("token-b")

	assert.NotEqual(t, hash1, hash2, "Different inputs should produce different hashes")
}

func TestHashToken_OutputFormat(t *testing.T) {
	hash := HashToken("test-input")

	// SHA256 produces 32 bytes = 64 hex characters
	assert.Len(t, hash, 64, "SHA256 hex-encoded hash should be 64 characters long")
}
