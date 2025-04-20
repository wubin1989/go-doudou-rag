package model

import (
	"gorm.io/gorm"
	"time"
)

type File struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	Path      string         `json:"path"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at"`
}
