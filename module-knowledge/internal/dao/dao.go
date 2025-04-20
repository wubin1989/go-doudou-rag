package dao

import (
	"gorm.io/gorm"
)

func Use(db *gorm.DB) {
	fileRepo.Use(db)
}

func GetFileRepo() *FileRepo {
	return fileRepo
}
