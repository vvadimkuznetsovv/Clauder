package config

import (
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port string

	DBHost     string
	DBPort     string
	DBUser     string
	DBPassword string
	DBName     string

	JWTSecret        string
	JWTExpiry        time.Duration
	JWTRefreshExpiry time.Duration

	ClaudeAllowedTools string
	ClaudeWorkingDir   string

	AdminUsername string
	AdminPassword string
}

func Load() *Config {
	godotenv.Load()
	godotenv.Load("../.env")

	return &Config{
		Port: getEnv("PORT", "8080"),

		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBUser:     getEnv("DB_USER", "nebulide"),
		DBPassword: getEnv("DB_PASSWORD", "nebulide"),
		DBName:     getEnv("DB_NAME", "nebulide"),

		JWTSecret:        getEnv("JWT_SECRET", "dev-secret-change-in-production"),
		JWTExpiry:        parseDuration(getEnv("JWT_EXPIRY", "15m")),
		JWTRefreshExpiry: parseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h")),

		ClaudeAllowedTools: getEnv("CLAUDE_ALLOWED_TOOLS", "Read,Edit,Write,Bash,Glob,Grep"),
		ClaudeWorkingDir:   getEnv("CLAUDE_WORKING_DIR", defaultWorkingDir()),

		AdminUsername: getEnv("ADMIN_USERNAME", "admin"),
		AdminPassword: getEnv("ADMIN_PASSWORD", ""),
	}
}

func (c *Config) DSN() string {
	return "host=" + c.DBHost +
		" user=" + c.DBUser +
		" password=" + c.DBPassword +
		" dbname=" + c.DBName +
		" port=" + c.DBPort +
		" sslmode=disable TimeZone=UTC"
}

// findProjectRoot walks up from the executable and current dir
// looking for the directory that contains .env (project root marker).
func findProjectRoot() string {
	var candidates []string
	if exe, err := os.Executable(); err == nil {
		exeDir := filepath.Dir(exe)
		candidates = append(candidates, exeDir, filepath.Join(exeDir, ".."))
	}
	if wd, err := os.Getwd(); err == nil {
		candidates = append(candidates, wd, filepath.Join(wd, ".."))
	}
	for _, c := range candidates {
		if _, err := os.Stat(filepath.Join(c, ".env")); err == nil {
			return filepath.Clean(c)
		}
	}
	return ""
}

func defaultWorkingDir() string {
	if runtime.GOOS == "windows" {
		if root := findProjectRoot(); root != "" {
			return filepath.Join(root, "workspace")
		}
		return filepath.Join(os.Getenv("USERPROFILE"), "workspace")
	}
	return "/home/nebulide/workspace"
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func parseDuration(s string) time.Duration {
	d, err := time.ParseDuration(s)
	if err != nil {
		return 15 * time.Minute
	}
	return d
}
