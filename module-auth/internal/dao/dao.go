package dao

import (
	"gorm.io/gorm"
)

func Use(db *gorm.DB) {
	userRepo.Use(db)
}

func GetUserRepo() *UserRepo {
	return userRepo
}

func Init() {
	userRepo.Init()
}
