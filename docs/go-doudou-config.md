# Go-Doudou微内核架构应用的配置管理

在基于Go-Doudou构建的微内核架构应用中，配置管理是一个重要的方面。良好的配置管理可以提高应用的灵活性、可维护性和部署便捷性。本文将基于go-doudou-rag项目，详细介绍Go-Doudou微内核架构应用的配置管理方式。

## 1. 配置管理概述

Go-Doudou的微内核架构应用采用了分层的配置管理方式：

1. **中央配置文件**：位于主应用目录下的`app.yml`，包含所有模块的配置项
2. **模块配置结构**：每个模块在自己的`config`包中定义配置结构体
3. **环境变量覆盖**：支持通过环境变量覆盖配置文件中的值

这种配置管理方式的优势在于：

- **集中管理**：核心配置集中在一个文件中，方便管理
- **模块化**：每个模块独立定义自己的配置结构，实现关注点分离
- **灵活部署**：支持通过环境变量在不同环境中覆盖配置值

## 2. 中央配置文件app.yml

`app.yml`是整个应用的中央配置文件，位于主应用目录下。它包含了所有模块的配置项，使用模块名作为配置分组的前缀。以下是go-doudou-rag项目的`app.yml`示例：

```yaml
toolkit:
  auth:
    jwt-secret: "my-jwt-secret"
    jwt-expires-in: "12h"

moduleauth:
  db:
    dsn: "/Users/wubin1989/workspace/cloud/unionj-cloud/go-doudou-rag/data/auth.db"

moduleknowledge:
  biz:
    file-save-path: "/Users/wubin1989/workspace/cloud/unionj-cloud/go-doudou-rag/data/files"
    vector-store:
      export-to-file: "/Users/wubin1989/workspace/cloud/unionj-cloud/go-doudou-rag/data/chromem-go.gob"
  db:
    dsn: "/Users/wubin1989/workspace/cloud/unionj-cloud/go-doudou-rag/data/knowledge.db"
  openai:
    base-url: "https://api.siliconflow.cn/v1"
    token:
    embedding-model: "BAAI/bge-large-zh-v1.5"

modulechat:
  openai:
    base-url: "https://api.siliconflow.cn/v1"
    token:
    embedding-model: "BAAI/bge-large-zh-v1.5"
    model: "Qwen/Qwen2.5-32B-Instruct"
```

配置文件的主要部分包括：

1. **toolkit**：通用工具包的配置，如JWT认证相关的密钥和过期时间
2. **moduleauth**：认证模块的配置，包含数据库连接字符串
3. **moduleknowledge**：知识库模块的配置，包含文件存储路径、向量数据库和OpenAI相关设置
4. **modulechat**：聊天模块的配置，包含OpenAI API的相关设置

## 3. 模块配置结构定义

每个模块在自己的`config`包中定义配置结构体，通过Go-Doudou的配置管理机制从中央配置文件或环境变量中加载配置值。

### 3.1 认证模块配置(module-auth)

```go
package config

import (
	_ "github.com/unionj-cloud/go-doudou/v2/framework/config"
	"github.com/unionj-cloud/toolkit/envconfig"
	"github.com/unionj-cloud/toolkit/zlogger"
)

var G_Config *Config

type Config struct {
	Biz struct {
	}
	Db struct {
		Dsn string
	}
}

func init() {
	var conf Config
	err := envconfig.Process("moduleauth", &conf)
	if err != nil {
		zlogger.Panic().Msgf("Error processing environment variables: %v", err)
	}
	G_Config = &conf
}

func LoadFromEnv() *Config {
	return G_Config
}
```

### 3.2 知识库模块配置(module-knowledge)

```go
package config

import (
	_ "github.com/unionj-cloud/go-doudou/v2/framework/config"
	"github.com/unionj-cloud/toolkit/envconfig"
	"github.com/unionj-cloud/toolkit/zlogger"
)

var G_Config *Config

type Config struct {
	Biz struct {
		FileSavePath string
		VectorStore  struct {
			ExportToFile string
		}
	}
	Openai struct {
		BaseUrl        string
		Token          string
		EmbeddingModel string
	}
	Db struct {
		Dsn string
	}
}

func init() {
	var conf Config
	err := envconfig.Process("moduleknowledge", &conf)
	if err != nil {
		zlogger.Panic().Msgf("Error processing environment variables: %v", err)
	}
	G_Config = &conf
}

func LoadFromEnv() *Config {
	return G_Config
}
```

### 3.3 聊天模块配置(module-chat)

```go
package config

import (
	_ "github.com/unionj-cloud/go-doudou/v2/framework/config"
	"github.com/unionj-cloud/toolkit/envconfig"
	"github.com/unionj-cloud/toolkit/zlogger"
)

var G_Config *Config

type Config struct {
	Openai struct {
		BaseUrl        string
		Token          string
		EmbeddingModel string
		Model          string
	}
}

func init() {
	var conf Config
	err := envconfig.Process("modulechat", &conf)
	if err != nil {
		zlogger.Panic().Msgf("Error processing environment variables: %v", err)
	}
	G_Config = &conf
}

func LoadFromEnv() *Config {
	return G_Config
}
```

## 4. 配置加载机制

Go-Doudou使用了简洁而强大的配置加载机制，主要通过以下步骤实现：

### 4.1 Go-Doudou配置框架的导入

每个模块的配置包中都有一个特殊的匿名导入：

```go
_ "github.com/unionj-cloud/go-doudou/v2/framework/config"
```

这个导入会触发Go-Doudou配置框架的初始化，将`app.yml`中的配置加载到内存中。

### 4.2 环境变量处理

通过`envconfig`库，Go-Doudou可以将环境变量值绑定到结构体字段上：

```go
err := envconfig.Process("moduleauth", &conf)
```

这里的`"moduleauth"`是前缀，表示只处理以`MODULEAUTH_`开头的环境变量。

### 4.3 配置的自动映射

配置值的映射遵循以下规则：

1. 结构体字段名转换为小写+下划线形式(`FileSavePath` -> `file_save_path`)
2. 添加前缀(`moduleauth_file_save_path`)
3. 查找对应的环境变量，如果不存在，则从`app.yml`中读取对应的值

### 4.4 全局配置实例

每个模块通过一个全局变量持有配置实例：

```go
var G_Config *Config

func LoadFromEnv() *Config {
	return G_Config
}
```

插件在初始化时会调用`LoadFromEnv()`获取配置实例。

## 5. 配置值获取途径优先级

Go-Doudou的配置值获取优先级如下：

1. **环境变量**：优先级最高，可以覆盖其他来源的值
2. **app.yml文件**：次优先级，是默认的配置来源
3. **结构体默认值**：最低优先级，当环境变量和配置文件都没有提供值时使用

例如，对于知识库模块的OpenAI API基础URL：

1. 首先查找环境变量`MODULEKNOWLEDGE_OPENAI_BASE_URL`
2. 如果不存在，则从`app.yml`中查找`moduleknowledge.openai.base-url`
3. 如果仍不存在，则使用结构体中定义的默认值(如果有)

## 6. 插件对配置的使用

插件在初始化时，会加载配置并使用它来配置服务实例。以`module-knowledge`插件为例：

```go
func init() {
	plugin.RegisterServicePlugin(&ModuleKnowledgePlugin{})

	do.Provide[service.ModuleKnowledge](nil, func(injector *do.Injector) (service.ModuleKnowledge, error) {
		conf := config.LoadFromEnv()

		db, err := gorm.Open(sqlite.Open(conf.Db.Dsn), &gorm.Config{})
		if err != nil {
			panic("failed to connect database")
		}

		if err = db.AutoMigrate(&model.File{}); err != nil {
			panic(err)
		}

		dao.Use(db)

		svc := service.NewModuleKnowledge(conf)
		return svc, nil
	})
}
```

在这个例子中，插件通过`config.LoadFromEnv()`获取配置，然后用它来：
1. 配置数据库连接
2. 初始化服务实例

## 7. 配置最佳实践

基于go-doudou-rag项目的经验，以下是一些配置管理的最佳实践：

### 7.1 敏感信息处理

对于API密钥等敏感信息，建议：
1. 在配置文件中留空
2. 通过环境变量注入
3. 或者使用密钥管理服务

例如，OpenAI API令牌在`app.yml`中是空的：

```yaml
openai:
  base-url: "https://api.siliconflow.cn/v1"
  token:  # 留空，通过环境变量设置
```

### 7.2 路径配置

对于文件路径，建议：
1. 使用相对路径+基础路径组合
2. 允许通过环境变量覆盖，以适应不同部署环境

### 7.3 模块化配置

每个模块只关注自己需要的配置项，保持配置的清晰和模块化：
1. 结构体字段直接反映配置项的层次结构
2. 使用嵌套结构体表示配置分组
3. 字段名使用驼峰命名法，对应YAML中的短横线命名法

### 7.4 配置验证

在加载配置后，建议添加验证逻辑确保必要的配置项已经设置：

```go
func ValidateConfig(conf *Config) error {
	if conf.Openai.BaseUrl == "" {
		return errors.New("OpenAI base URL is required")
	}
	// 其他验证...
	return nil
}
```

## 8. Docker环境的配置

在Docker环境中，可以通过以下方式配置应用：

### 8.1 使用环境变量

```dockerfile
FROM golang:1.18 as builder
# ...构建阶段...

FROM alpine:latest
# ...
ENV MODULEAUTH_DB_DSN=/data/auth.db
ENV MODULEKNOWLEDGE_BIZ_FILE_SAVE_PATH=/data/files
ENV MODULEKNOWLEDGE_OPENAI_BASE_URL=https://api.siliconflow.cn/v1
ENV MODULEKNOWLEDGE_OPENAI_TOKEN=your-api-key
# ...其他环境变量...
COPY --from=builder /app/main /app/
WORKDIR /app
CMD ["./main"]
```

### 8.2 挂载配置文件

```yaml
version: '3'
services:
  rag-app:
    image: go-doudou-rag:latest
    volumes:
      - ./app.yml:/app/app.yml
      - ./data:/data
    ports:
      - "6060:6060"
```

## 9. 总结

Go-Doudou微内核架构应用的配置管理采用了集中式配置文件与模块化配置结构相结合的方式，实现了配置的集中管理与模块自治的平衡。通过环境变量覆盖机制，可以在不同环境中灵活部署应用。

这种配置管理方式的优势包括：
1. **配置集中**：所有配置项集中在一个文件中，便于管理
2. **职责分离**：每个模块只关注自己的配置
3. **部署灵活**：支持通过环境变量在不同环境中覆盖配置
4. **类型安全**：配置项映射到Go结构体，提供类型安全

在实际项目中，良好的配置管理可以大大提高应用的可维护性和可部署性，是微内核架构应用成功的关键因素之一。 