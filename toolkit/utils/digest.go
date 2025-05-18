package utils

import (
	"crypto/sha256"
	"encoding/base64"
)

func GenerateBase64URLSafeSHA256ID(text string) string {
	hash := sha256.Sum256([]byte(text))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}
