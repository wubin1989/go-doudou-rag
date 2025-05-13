package dao

import (
	"context"
	"github.com/unionj-cloud/toolkit/sliceutils"
	"github.com/unionj-cloud/toolkit/stringutils"
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

type ListReq struct {
	FileId string
}

func (fr *FileRepo) List(ctx context.Context, listReq ListReq) []*model.File {
	var files []*model.File

	tx := fr.db
	if stringutils.IsNotEmpty(listReq.FileId) {
		fileIds := stringutils.Split(listReq.FileId, ",")
		fileIdList := sliceutils.StringSlice2InterfaceSlice(fileIds)
		tx = tx.Where("id in (?)", fileIdList)
	}

	if err := tx.Find(&files).Error; err != nil {
		panic(err)
	}

	return files
}
