package dao

import (
	"context"
	"go-doudou-rag/module-knowledge/dto"
	"go-doudou-rag/module-knowledge/internal/model"
	"gorm.io/gorm"
)

var fileRepo *FileRepo

func init() {
	fileRepo = &FileRepo{}
}

type FileRepo struct {
	db *gorm.DB
}

func (fr *FileRepo) Use(db *gorm.DB) {
	fr.db = db
}

func (fr *FileRepo) Save(ctx context.Context, file dto.FileDTO) uint {
	fileModel := model.File{
		Path: file.Path,
	}

	if err := fr.db.Create(&fileModel).Error; err != nil {
		panic(err)
	}

	return fileModel.ID
}

func (fr *FileRepo) List(ctx context.Context) []*model.File {
	var files []*model.File
	if err := fr.db.Find(&files).Error; err != nil {
		panic(err)
	}

	return files
}
