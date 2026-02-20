package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/datatypes"
)

type Message struct {
	ID         uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	SessionID  uuid.UUID      `gorm:"type:uuid;not null;index" json:"session_id"`
	Role       string         `gorm:"size:20;not null" json:"role"` // user, assistant, system
	Content    string         `gorm:"type:text;not null" json:"content"`
	ToolUse    datatypes.JSON `gorm:"type:jsonb" json:"tool_use,omitempty"`
	TokensUsed int            `gorm:"default:0" json:"tokens_used"`
	CreatedAt  time.Time      `json:"created_at"`

	Session ChatSession `gorm:"foreignKey:SessionID" json:"-"`
}

func (m *Message) BeforeCreate(tx *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
