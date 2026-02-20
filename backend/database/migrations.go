package database

import (
	"fmt"
	"log"

	"clauder/models"
)

func Migrate() {
	err := DB.AutoMigrate(
		&models.User{},
		&models.ChatSession{},
		&models.Message{},
		&models.RefreshToken{},
	)
	if err != nil {
		log.Fatalf("Failed to run migrations: %v", err)
	}
	fmt.Println("Migrations completed")
}
