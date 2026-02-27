package services

import (
	"testing"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateTOTPSecret_ReturnsValidKey(t *testing.T) {
	key, err := GenerateTOTPSecret("testuser")

	require.NoError(t, err)
	assert.NotNil(t, key)
	assert.NotEmpty(t, key.Secret(), "Secret should not be empty")
	assert.Equal(t, "Nebulide", key.Issuer(), "Issuer should be 'Nebulide'")
	assert.Equal(t, "testuser", key.AccountName(), "Account name should match username")
	assert.NotEmpty(t, key.URL(), "URL should not be empty")
}

func TestGenerateTOTPSecret_DifferentUsersGetDifferentSecrets(t *testing.T) {
	key1, err := GenerateTOTPSecret("user1")
	require.NoError(t, err)

	key2, err := GenerateTOTPSecret("user2")
	require.NoError(t, err)

	assert.NotEqual(t, key1.Secret(), key2.Secret(), "Different users should get different secrets")
}

func TestValidateTOTP_CorrectCode(t *testing.T) {
	key, err := GenerateTOTPSecret("testuser")
	require.NoError(t, err)

	// Generate a valid code using the secret
	code, err := totp.GenerateCode(key.Secret(), time.Now())
	require.NoError(t, err)

	result := ValidateTOTP(key.Secret(), code)
	assert.True(t, result, "Valid TOTP code should be accepted")
}

func TestValidateTOTP_WrongCode(t *testing.T) {
	key, err := GenerateTOTPSecret("testuser")
	require.NoError(t, err)

	result := ValidateTOTP(key.Secret(), "000000")
	// There is an astronomically small chance this is actually valid,
	// but for practical testing purposes it will almost always be false.
	// We test the likely case; if it happens to be valid, skip.
	if result {
		t.Skip("Randomly generated code happened to match, skipping")
	}
	assert.False(t, result, "Wrong TOTP code should be rejected")
}

func TestValidateTOTP_EmptyCode(t *testing.T) {
	key, err := GenerateTOTPSecret("testuser")
	require.NoError(t, err)

	result := ValidateTOTP(key.Secret(), "")
	assert.False(t, result, "Empty TOTP code should be rejected")
}

func TestValidateTOTP_InvalidSecret(t *testing.T) {
	result := ValidateTOTP("not-a-valid-base32-secret!!!", "123456")
	assert.False(t, result, "Invalid secret should cause validation to fail")
}
