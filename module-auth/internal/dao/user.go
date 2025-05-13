package dao

import (
	"context"
	"go-doudou-rag/module-auth/internal/model"
	"gorm.io/gorm"
)

var userRepo *UserRepo

func init() {
	userRepo = &UserRepo{}
}

type UserRepo struct {
	db *gorm.DB
}

func (ur *UserRepo) Use(db *gorm.DB) {
	ur.db = db
}

func (ur *UserRepo) Init() {
	admin := model.User{
		Username: "admin",
		Password: "admin",
	}
	if err := ur.db.Save(&admin).Error; err != nil {
		panic(err)
	}
}

func (ur *UserRepo) FindOneByUsername(ctx context.Context, username string) *model.User {
	var users []*model.User
	if err := ur.db.Where("username = ?", username).Find(&users).Error; err != nil {
		panic(err)
	}

	if len(users) == 0 {
		return nil
	}
	return users[0]
}
