package services

import (
	"github.com/pquerna/otp"
	"github.com/pquerna/otp/totp"
)

func GenerateTOTPSecret(username string) (*otp.Key, error) {
	return totp.Generate(totp.GenerateOpts{
		Issuer:      "Clauder",
		AccountName: username,
	})
}

func ValidateTOTP(secret, code string) bool {
	return totp.Validate(code, secret)
}
