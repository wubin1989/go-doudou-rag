/**
* Generated by go-doudou v2.5.9.
* You can edit it as your need.
 */
package dto

//go:generate go-doudou name --file $GOFILE --form --case snake

type GddUser struct {
	Id    int64  `json:"id" form:"id"`
	Name  string `json:"name" form:"name"`
	Phone string `json:"phone" form:"phone"`
	Dept  string `json:"dept" form:"dept"`
}

// Page result wrapper
type Page struct {
	Items      []interface{} `json:"items" form:"items"`
	Page       int64         `json:"page" form:"page"`
	Size       int64         `json:"size" form:"size"`
	MaxPage    int64         `json:"max_page" form:"max_page"`
	TotalPages int64         `json:"total_pages" form:"total_pages"`
	Total      int64         `json:"total" form:"total"`
	Last       bool          `json:"last" form:"last"`
	First      bool          `json:"first" form:"first"`
	Visible    int64         `json:"visible" form:"visible"`
}

// Parameter struct
type Parameter struct {
	Page    int64  `json:"page" form:"page"`
	Size    int64  `json:"size" form:"size"`
	Sort    string `json:"sort" form:"sort"`
	Order   string `json:"order" form:"order"`
	Fields  string `json:"fields" form:"fields"`
	Filters string `json:"filters" form:"filters"`
}

func (receiver Parameter) GetPage() int64 {
	return receiver.Page
}

func (receiver Parameter) GetSize() int64 {
	return receiver.Size
}

func (receiver Parameter) GetSort() string {
	return receiver.Sort
}

func (receiver Parameter) GetOrder() string {
	return receiver.Order
}

func (receiver Parameter) GetFields() string {
	return receiver.Fields
}

func (receiver Parameter) GetFilters() interface{} {
	return receiver.Filters
}

func (receiver Parameter) IParameterInstance() {

}

type ChatRequest struct {
	Prompt string `json:"prompt" validate:"required" form:"prompt"`
	// 多个值英文逗号拼接
	FileId string `json:"file_id" form:"file_id"`
}

type ChatResponse struct {
	Content   string `json:"content" form:"content"`
	RequestID string `json:"request_id" form:"request_id"`
	Type      string `json:"type" form:"type"`
}
