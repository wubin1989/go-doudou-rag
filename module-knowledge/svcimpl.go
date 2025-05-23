/**
* Generated by go-doudou v2.5.9.
* You can edit it as your need.
 */
package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	concpool "github.com/sourcegraph/conc/pool"
	"go-doudou-rag/toolkit/utils"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"

	"github.com/klippa-app/go-pdfium"
	"github.com/klippa-app/go-pdfium/requests"
	"github.com/klippa-app/go-pdfium/webassembly"
	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu"
	pdfmodel "github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/philippgille/chromem-go"
	"github.com/samber/lo"
	"github.com/spf13/cast"
	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
	"github.com/tmc/langchaingo/schema"
	"github.com/tmc/langchaingo/textsplitter"
	v3 "github.com/unionj-cloud/toolkit/openapi/v3"
	"github.com/unionj-cloud/toolkit/stringutils"

	"go-doudou-rag/module-knowledge/config"
	"go-doudou-rag/module-knowledge/dto"
	"go-doudou-rag/module-knowledge/internal/dao"
	"go-doudou-rag/module-knowledge/internal/model"
)

var pool pdfium.Pool
var instance pdfium.Pdfium

func init() {
	var err error

	// Init the PDFium library and return the instance to open documents.
	// You can tweak these configs to your need. Be aware that workers can use quite some memory.
	pool, err = webassembly.Init(webassembly.Config{
		MinIdle:  1, // Makes sure that at least x workers are always available
		MaxIdle:  1, // Makes sure that at most x workers are ever available
		MaxTotal: 1, // Maxium amount of workers in total, allows the amount of workers to grow when needed, items between total max and idle max are automatically cleaned up, while idle workers are kept alive so they can be used directly.
	})
	if err != nil {
		log.Fatal(err)
	}

	instance, err = pool.GetInstance(time.Second * 30)
	if err != nil {
		log.Fatal(err)
	}
}

var _ ModuleKnowledge = (*ModuleKnowledgeImpl)(nil)

type ModuleKnowledgeImpl struct {
	conf        *config.Config
	collection  *chromem.Collection
	vectorStore *chromem.DB
}

func NewModuleKnowledge(conf *config.Config) *ModuleKnowledgeImpl {
	db := chromem.NewDB()
	db.ImportFromFile(conf.Biz.VectorStore.ExportToFile, "")

	embeddingFunc := chromem.NewEmbeddingFuncOpenAICompat(conf.Openai.BaseUrl,
		lo.Ternary(stringutils.IsNotEmpty(conf.Openai.Token), conf.Openai.Token, os.Getenv("OPENAI_API_KEY")),
		conf.Openai.EmbeddingModel, nil)
	c, err := db.GetOrCreateCollection("knowledge-base", nil, embeddingFunc)
	if err != nil {
		panic(err)
	}

	return &ModuleKnowledgeImpl{
		conf:        conf,
		collection:  c,
		vectorStore: db,
	}
}

func (receiver *ModuleKnowledgeImpl) Upload(ctx context.Context, file v3.FileModel) (data dto.UploadResult, err error) {
	defer func() {
		file.Close()
	}()

	if filepath.Ext(file.Filename) != ".pdf" {
		panic("not a pdf file")
	}

	_ = os.MkdirAll(receiver.conf.Biz.FileSavePath, os.ModePerm)
	out := filepath.Join(receiver.conf.Biz.FileSavePath, file.Filename)
	var f *os.File
	f, err = os.OpenFile(out, os.O_WRONLY|os.O_CREATE, os.ModePerm)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	_, err = io.Copy(f, file.Reader)
	if err != nil {
		panic(err)
	}

	fileBytes, err := os.ReadFile(out)
	if err != nil {
		panic(err)
	}

	doc, err := instance.FPDF_LoadDocument(&requests.FPDF_LoadDocument{
		Path: &out,
	})
	if err != nil {
		panic(err)
	}

	// Always close the document, this will release its resources.
	defer instance.FPDF_CloseDocument(&requests.FPDF_CloseDocument{
		Document: doc.Document,
	})

	pageCount, err := instance.FPDF_GetPageCount(&requests.FPDF_GetPageCount{
		Document: doc.Document,
	})
	if err != nil {
		panic(err)
	}

	fileName := strings.TrimSuffix(filepath.Base(out), ".pdf")

	g := concpool.NewWithResults[[]schema.Document]().WithContext(ctx).WithCancelOnError()

	for i := 0; i < pageCount.PageCount; i++ {
		g.Go(func(ctx context.Context) ([]schema.Document, error) {

			var docs []schema.Document

			// 获取页面文本
			pageText, err := instance.GetPageText(&requests.GetPageText{
				Page: requests.Page{
					ByIndex: &requests.PageByIndex{
						Document: doc.Document,
						Index:    i,
					},
				},
			})
			if err != nil {
				panic(err)
			}

			docs = append(docs, schema.Document{
				PageContent: pageText.Text,
				Metadata: map[string]any{
					"page":        i,
					"total_pages": pageCount.PageCount,
					"type":        "text",
				},
			})

			var imageOutFile string
			if err = api.ExtractImages(bytes.NewReader(fileBytes), []string{cast.ToString(i)}, func(img pdfmodel.Image, singleImgPerPage bool, maxPageDigits int) error {
				if img.Reader == nil {
					return nil
				}
				s := "%s_%" + fmt.Sprintf("0%dd", maxPageDigits)
				qual := img.Name
				if img.Thumb {
					qual = "thumb"
				}
				f := fmt.Sprintf(s+"_%s.%s", fileName, img.PageNr, qual, img.FileType)
				imageOutFile = filepath.Join(receiver.conf.Biz.FileSavePath, f)
				return pdfcpu.WriteReader(imageOutFile, img)
			}, nil); err != nil {
				panic(err)
			}

			if stringutils.IsNotEmpty(imageOutFile) {
				imageDescription := receiver.analyzeImageWithMultiModal(ctx, imageOutFile)

				if stringutils.IsNotEmpty(imageDescription) {
					docs = append(docs, schema.Document{
						PageContent: imageDescription,
						Metadata: map[string]any{
							"page":        i,
							"total_pages": pageCount.PageCount,
							"file":        imageOutFile,
							"type":        "image",
						},
					})
				}
			}

			return docs, nil
		})

	}

	groups, err := g.Wait()
	if err != nil {
		panic(err)
	}

	if len(groups) == 0 {
		panic("内容为空")
	}

	var docs []schema.Document
	lo.ForEach(groups, func(items []schema.Document, index int) {
		docs = append(docs, items...)
	})

	sort.SliceStable(docs, func(i, j int) bool {
		pageNoI := cast.ToInt(docs[i].Metadata["page"])
		pageNoJ := cast.ToInt(docs[j].Metadata["page"])
		return pageNoI < pageNoJ
	})

	splitter := textsplitter.NewRecursiveCharacter(
		textsplitter.WithChunkSize(500),
		textsplitter.WithChunkOverlap(100),
	)

	// 分割文档
	splitDocs, err := textsplitter.SplitDocuments(splitter, docs)
	if err != nil {
		panic(err)
	}

	var documents []chromem.Document
	lo.ForEach(splitDocs, func(item schema.Document, index int) {
		metadata := lo.MapEntries[string, any, string, string](item.Metadata, func(key string, value any) (string, string) {
			return key, cast.ToString(value)
		})

		metadata["file"] = out

		documents = append(documents, chromem.Document{
			ID:       utils.GenerateBase64URLSafeSHA256ID(item.PageContent),
			Content:  item.PageContent,
			Metadata: metadata,
		})
	})

	if err = receiver.collection.AddDocuments(ctx, documents, runtime.NumCPU()); err != nil {
		panic(err)
	}

	if err = receiver.vectorStore.ExportToFile(receiver.conf.Biz.VectorStore.ExportToFile, false, ""); err != nil {
		panic(err)
	}

	fileRepo := dao.GetFileRepo()
	id := fileRepo.Save(ctx, dto.FileDTO{
		Path: out,
	})

	return dto.UploadResult{
		Id: id,
	}, nil
}

func (receiver *ModuleKnowledgeImpl) extractContentFromPdf(ctx context.Context, file *model.File) (data string) {
	doc, err := instance.FPDF_LoadDocument(&requests.FPDF_LoadDocument{
		Path: &file.Path,
	})
	if err != nil {
		panic(err)
	}

	// Always close the document, this will release its resources.
	defer instance.FPDF_CloseDocument(&requests.FPDF_CloseDocument{
		Document: doc.Document,
	})

	pageCount, err := instance.FPDF_GetPageCount(&requests.FPDF_GetPageCount{
		Document: doc.Document,
	})
	if err != nil {
		panic(err)
	}

	fileBytes, err := os.ReadFile(file.Path)
	if err != nil {
		panic(err)
	}

	fileName := strings.TrimSuffix(filepath.Base(file.Path), ".pdf")

	var content string
	for i := 0; i < pageCount.PageCount; i++ {
		pageText, err := instance.GetPageText(&requests.GetPageText{
			Page: requests.Page{
				ByIndex: &requests.PageByIndex{
					Document: doc.Document,
					Index:    i,
				},
			},
		})
		if err != nil {
			panic(err)
		}

		content += pageText.Text

		var imageOutFile string
		if err = api.ExtractImages(bytes.NewReader(fileBytes), []string{cast.ToString(i)}, func(img pdfmodel.Image, singleImgPerPage bool, maxPageDigits int) error {
			if img.Reader == nil {
				return nil
			}
			s := "%s_%" + fmt.Sprintf("0%dd", maxPageDigits)
			qual := img.Name
			if img.Thumb {
				qual = "thumb"
			}
			f := fmt.Sprintf(s+"_%s.%s", fileName, img.PageNr, qual, img.FileType)
			imageOutFile = filepath.Join(receiver.conf.Biz.FileSavePath, f)
			return pdfcpu.WriteReader(imageOutFile, img)
		}, nil); err != nil {
			panic(err)
		}

		if stringutils.IsNotEmpty(imageOutFile) {
			imageDescription := receiver.analyzeImageWithMultiModal(ctx, imageOutFile)
			content += imageDescription
		}
	}

	return content
}

func (receiver *ModuleKnowledgeImpl) GetList(ctx context.Context, req dto.GetListReq) (data []dto.FileDTO, _ error) {
	fileRepo := dao.GetFileRepo()

	listReq := dao.ListReq{
		FileId: req.FileId,
	}
	fileModels := fileRepo.List(ctx, listReq)

	lo.ForEach(fileModels, func(item *model.File, index int) {

		var content string

		if req.WithContent {
			content = receiver.extractContentFromPdf(ctx, item)
		}

		data = append(data, dto.FileDTO{
			Id:      item.ID,
			Path:    item.Path,
			Content: content,
		})
	})

	return data, nil
}

func (receiver *ModuleKnowledgeImpl) GetQuery(ctx context.Context, req dto.QueryReq) (data []dto.QueryResult, err error) {
	if stringutils.IsEmpty(req.Text) {
		panic("empty text")
	}

	nResults := req.RetrieveLimit
	if nResults > receiver.collection.Count() {
		nResults = receiver.collection.Count()
	}

	res, err := receiver.collection.Query(ctx, req.Text, nResults, nil, nil)
	if err != nil {
		panic(err)
	}

	lo.ForEach(res, func(item chromem.Result, index int) {
		if item.Similarity >= req.SimilarityThreshold {
			data = append(data, dto.QueryResult{
				ID:         item.ID,
				Similarity: item.Similarity,
				Content:    item.Content,
			})
		}
	})

	return data, nil
}

// analyzeImageWithMultiModal 使用多模态大模型分析图片，提取文字并描述图片内容
func (receiver *ModuleKnowledgeImpl) analyzeImageWithMultiModal(ctx context.Context, file string) string {

	// 初始化OpenAI客户端 (使用GPT-4 Vision或其他多模态模型)
	// 从配置中获取API密钥
	llm, err := openai.New(
		openai.WithBaseURL(receiver.conf.Openai.BaseUrl),
		openai.WithToken(lo.Ternary(stringutils.IsNotEmpty(receiver.conf.Openai.Token), receiver.conf.Openai.Token, os.Getenv("OPENAI_API_KEY"))),
		openai.WithEmbeddingModel(receiver.conf.Openai.EmbeddingModel),
		openai.WithModel(receiver.conf.Openai.Model),
	)
	if err != nil {
		panic(fmt.Errorf("初始化OpenAI客户端失败: %w", err))
	}

	imgData, err := os.ReadFile(file)
	if err != nil {
		panic(err)
	}

	// {
	//            "type": "image_url",
	//            "image_url": {
	//                "url": f"data:image/jpeg;base64,{base64_image}",
	//                "detail":"low"
	//            }
	//        },

	// 将图片转换为Base64
	imgBase64 := base64.StdEncoding.EncodeToString(imgData)
	contentType := http.DetectContentType(imgData)
	imgUrl := fmt.Sprintf(`data:%s;base64,%s`, contentType, imgBase64)

	// 创建包含图片的提示
	// 注意: 这里的实现依赖于OpenAI的Vision API
	// 其他模型可能需要不同的实现方式
	prompt := fmt.Sprintf(`上面是一张图片。请执行两项任务:
1. 如果图片包含任何文字，请提取并返回所有可见文字。
2. 详细描述图片中显示的内容。

请按以下格式返回:
图片文字: [图片中的所有文字，如果没有则返回"无文字"]
图片描述: [对图片内容的详细描述]`)

	// 发送请求到模型
	content := []llms.MessageContent{
		{
			Role: llms.ChatMessageTypeHuman,
			Parts: []llms.ContentPart{
				llms.ImageURLPart(imgUrl),
				llms.TextPart(prompt),
			},
		},
	}

	contentResponse, err := llm.GenerateContent(ctx, content,
		llms.WithMaxTokens(4096),
		llms.WithTemperature(0.2),
	)
	if err != nil {
		panic(err)
	}

	return contentResponse.Choices[0].Content
}
