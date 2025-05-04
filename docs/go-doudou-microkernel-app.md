# go-doudou + langchaingo 微内核架构RAG大模型知识库实战（二）

在上一篇文章中，我们介绍了go-doudou框架中的插件机制与模块化可插拔微内核架构的基本概念和原理。本篇文章将详细讲解如何从零开始搭建一个基于go-doudou的微内核架构应用，帮助新人快速上手开发。

## 1. 微内核架构应用的概念回顾

微内核架构（也称为插件架构）将应用分为核心系统和插件模块：

- **核心系统**：提供基础服务和插件管理机制
- **插件模块**：独立开发、独立部署的功能单元

这种架构的优势在于：

1. **高内聚、低耦合**：各模块之间通过定义明确的接口通信
2. **可扩展性强**：无需修改核心系统即可添加新功能
3. **灵活部署**：可按需加载模块，系统更加轻量
4. **独立开发**：团队可以并行开发不同模块

go-doudou框架通过其强大的CLI工具和插件机制，使得构建微内核架构应用变得更加简单高效。

## 2. 环境准备

### 2.1 安装go-doudou CLI

首先，我们需要安装go-doudou命令行工具。对于Go 1.17及以上版本，推荐使用以下命令全局安装：

```bash
go install -v github.com/unionj-cloud/go-doudou/v2@v2.5.9
```

安装完成后，可以通过以下命令验证安装是否成功：

```bash
go-doudou version
```

### 2.2 开发环境要求

- Go 1.16及以上版本
- Git（版本管理）
- 支持Go模块的IDE（推荐GoLand或Visual Studio Code）

## 3. 创建工作空间

go-doudou提供了`work`命令来创建和管理工作空间，这是构建微内核架构应用的第一步。

### 3.1 初始化工作空间

```bash
# 创建一个名为go-doudou-rag的工作空间
go-doudou work init go-doudou-rag

# 进入工作空间目录
cd go-doudou-rag
```

这个命令会创建一个包含以下结构的工作空间：

```
go-doudou-rag/
  ├── go.work          # Go工作空间文件
  ├── main/            # 主应用模块
  │   ├── cmd/         # 主程序入口
  │   └── config/      # 主程序配置
```

工作空间创建后，自动初始化了Git仓库并生成了`.gitignore`文件。`main`模块是应用的核心，它将负责加载和管理所有插件模块。

## 4. 创建微内核架构应用的核心模块

主模块是微内核架构的核心，负责加载和管理插件。我们需要理解并修改主模块的核心代码。

### 4.1 理解主模块的结构

主模块的`cmd/main.go`文件包含了初始化和启动应用的代码。在go-doudou微内核架构中，这个文件通常包含以下内容：

```go
package main

import (
    "github.com/unionj-cloud/go-doudou/v2/framework/grpcx"
    "github.com/unionj-cloud/go-doudou/v2/framework/plugin"
    "github.com/unionj-cloud/go-doudou/v2/framework/rest"
    "github.com/unionj-cloud/toolkit/pipeconn"
    "github.com/unionj-cloud/toolkit/zlogger"
    
    // 以下是导入的插件模块，初始阶段可能没有
)

func main() {
    // 创建REST服务器
    srv := rest.NewRestServer()
    
    // 创建gRPC服务器（如果需要）
    grpcServer := grpcx.NewGrpcServer()
    lis, dialCtx := pipeconn.NewPipeListener()
    
    // 获取所有注册的服务插件
    plugins := plugin.GetServicePlugins()
    for _, key := range plugins.Keys() {
        value, _ := plugins.Get(key)
        // 初始化每个插件
        value.Initialize(srv, grpcServer, dialCtx)
    }
    
    // 资源清理
    defer func() {
        if r := recover(); r != nil {
            zlogger.Info().Msgf("Recovered. Error: %v\n", r)
        }
        // 关闭所有插件
        for _, key := range plugins.Keys() {
            value, _ := plugins.Get(key)
            value.Close()
        }
    }()
    
    // 启动gRPC服务器
    go func() {
        grpcServer.RunWithPipe(lis)
    }()
    
    // 添加API文档路由
    srv.AddRoutes(rest.DocRoutes(""))
    
    // 启动REST服务器
    srv.Run()
}
```

这段代码实现了微内核架构的核心功能：获取注册的插件，初始化它们，并在应用退出时释放资源。

### 4.2 添加通用中间件和工具

在主模块中，我们通常会添加一些通用的中间件和工具，例如认证、日志、监控等。以JWT认证中间件为例：

```bash
mkdir -p toolkit/auth
```

在`toolkit/auth`目录下创建`auth.go`文件，实现JWT认证中间件：

```go
package auth

import (
	"context"
	"fmt"
	"github.com/golang-jwt/jwt/v5"
	"github.com/unionj-cloud/go-doudou/v2/framework"
	"github.com/unionj-cloud/go-doudou/v2/framework/rest/httprouter"
	"github.com/unionj-cloud/toolkit/copier"
	"go-doudou-rag/toolkit/config"
	"net/http"
	"slices"
	"strings"
	"time"
)

var authMiddleware *AuthMiddleware

func init() {
	conf := config.LoadFromEnv()
	authMiddleware = &AuthMiddleware{
		JwtSecret:    conf.Auth.JwtSecret,
		JwtExpiresIn: conf.Auth.JwtExpiresIn,
	}
}

func JwtToken(userInfo UserInfo) string {
	return authMiddleware.JwtToken(userInfo)
}

func Jwt(inner http.Handler) http.Handler {
	return authMiddleware.Jwt(inner)
}

type AuthMiddleware struct {
	JwtSecret    string
	JwtExpiresIn time.Duration
}

type UserInfo struct {
	Username string `json:"username"`
}

type ctxKey int

const userInfoKey ctxKey = ctxKey(0)

func NewUserInfoContext(ctx context.Context, userInfo UserInfo) context.Context {
	return context.WithValue(ctx, userInfoKey, userInfo)
}

func UserInfoFromContext(ctx context.Context) (UserInfo, bool) {
	userInfo, ok := ctx.Value(userInfoKey).(UserInfo)
	return userInfo, ok
}

func (auth *AuthMiddleware) JwtToken(userInfo UserInfo) string {
	var claims jwt.MapClaims
	err := copier.DeepCopy(userInfo, &claims)
	if err != nil {
		panic(err)
	}

	claims["exp"] = time.Now().Add(auth.JwtExpiresIn).Unix()

	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(auth.JwtSecret))
	if err != nil {
		panic(err)
	}
	return token
}

func (auth *AuthMiddleware) Jwt(inner http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		paramsFromCtx := httprouter.ParamsFromContext(r.Context())
		routeName := paramsFromCtx.MatchedRouteName()

		annotation, ok := framework.GetAnnotation(routeName, "@role")
		if ok && slices.Contains(annotation.Params, "guest") {
			inner.ServeHTTP(w, r)
			return
		}

		authHeader := r.Header.Get("Authorization")
		tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))

		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(auth.JwtSecret), nil
		})
		if err != nil || !token.Valid {
			w.WriteHeader(401)
			w.Write([]byte("Unauthorised.\n"))
			return
		}

		claims := token.Claims.(jwt.MapClaims)

		var userInfo UserInfo
		err = copier.DeepCopy(claims, &userInfo)
		if err != nil {
			panic(err)
		}

		r = r.WithContext(NewUserInfoContext(r.Context(), userInfo))
		inner.ServeHTTP(w, r)
	})
}
```

然后在主模块的`main.go`中使用这个中间件：

```go
func main() {
    srv := rest.NewRestServer()
    // 添加JWT中间件
    srv.Use(auth.Jwt)
    
    // 其他代码...
}
```

## 5. 创建功能模块

接下来，我们创建具体的功能模块。每个模块是一个独立的Go模块，但会被注册为主应用的插件。我们将创建三个示例模块：认证模块、知识库模块和聊天模块。

### 5.1 创建认证模块

```bash
# 在工作空间根目录执行
# 创建认证模块
go-doudou svc init module-auth -m go-doudou-rag/module-auth --module --case snake -t rest
```

参数说明：
- `svc init`: 初始化服务
- `module-auth`: 服务名称
- `-m go-doudou-rag/module-auth`: 模块导入路径
- `--module`: 指定这是工作空间中的一个模块
- `--case snake`：使用蛇形命名风格
- `-t rest`：生成RESTful服务

这个命令会创建`module-auth`目录，并生成基本的模块结构：

```
module-auth/
  ├── cmd/            # 独立运行入口
  ├── config/         # 模块配置
  ├── dto/            # 数据传输对象
  ├── plugin/         # 插件实现
  ├── transport/      # 传输层
  │   └── httpsrv/    # HTTP服务
  ├── go.mod          # Go模块文件
  ├── svc.go          # 服务接口定义
  └── svcimpl.go      # 服务实现
```

同时，go-doudou会自动执行`go work use module-auth`将新模块添加到工作空间，并更新主模块的`main.go`文件，添加对新模块插件的导入：

```go
import (
    // 其他导入...
    _ "go-doudou-rag/module-auth/plugin"
)
```

### 5.2 定义服务接口

编辑`module-auth/svc.go`文件，定义认证服务的接口：

```go
package service

import (
	"context"
	"go-doudou-rag/module-auth/dto"
	"go-doudou-rag/module-auth/internal/model"
)

//go:generate go-doudou svc http --case snake

type ModuleAuth interface {
	// PostLogin @role(guest)
	PostLogin(ctx context.Context, req dto.LoginReq) (data string, err error)
	GetMe(ctx context.Context) (data *model.User, err error)
}
```

注意`//go:generate`指令，它告诉go-doudou生成HTTP相关代码。

### 5.3 创建DTO和模型

在`dto`目录下创建`login.go`文件：

```go
package dto

type LoginReq struct {
    Username string `json:"username" validate:"required"`
    Password string `json:"password" validate:"required"`
}
```

在`internal/model`目录下创建`user.go`文件：

```go
package model

import "time"

type User struct {
    ID        uint      `gorm:"primarykey" json:"id"`
    Username  string    `json:"username"`
    Password  string    `json:"-"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

### 5.4 实现服务逻辑

编辑`module-auth/svcimpl.go`文件，实现认证服务的逻辑：

```go
package service

import (
	"context"
	"go-doudou-rag/module-auth/config"
	"go-doudou-rag/module-auth/dto"
	"go-doudou-rag/module-auth/internal/dao"
	"go-doudou-rag/module-auth/internal/model"
	"go-doudou-rag/toolkit/auth"
)

var _ ModuleAuth = (*ModuleAuthImpl)(nil)

type ModuleAuthImpl struct {
	conf *config.Config
}

func NewModuleAuth(conf *config.Config) *ModuleAuthImpl {
	return &ModuleAuthImpl{
		conf: conf,
	}
}

func (receiver *ModuleAuthImpl) PostLogin(ctx context.Context, req dto.LoginReq) (data string, err error) {
	userRepo := dao.GetUserRepo()
	user := userRepo.FindOneByUsername(ctx, req.Username)
	if user == nil {
		panic("user not found")
	}

	if user.Password != req.Password {
		panic("wrong password")
	}

	data = auth.JwtToken(auth.UserInfo{
		Username: user.Username,
	})
	return data, nil
}

func (receiver *ModuleAuthImpl) GetMe(ctx context.Context) (data *model.User, err error) {
	userInfo, _ := auth.UserInfoFromContext(ctx)

	userRepo := dao.GetUserRepo()
	user := userRepo.FindOneByUsername(ctx, userInfo.Username)

	return user, nil
}
```

### 5.5 数据访问层

在`internal/dao`目录下创建`user.go`文件，实现数据访问：

```go
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
```

### 5.6 配置模块

编辑`module-auth/config/config.go`文件，定义模块配置：

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

### 5.7 插件实现

`plugin`目录下已经生成了插件的基本实现。我们需要确保该插件正确初始化数据库和服务。编辑`module-auth/plugin/plugin.go`文件：

```go
package plugin

import (
	"github.com/glebarez/sqlite"
	"github.com/unionj-cloud/go-doudou/v2/framework/grpcx"
	"github.com/unionj-cloud/go-doudou/v2/framework/plugin"
	"github.com/unionj-cloud/go-doudou/v2/framework/rest"
	"github.com/unionj-cloud/toolkit/pipeconn"
	"github.com/unionj-cloud/toolkit/stringutils"
	service "go-doudou-rag/module-auth"
	"go-doudou-rag/module-auth/config"
	"go-doudou-rag/module-auth/internal/dao"
	"go-doudou-rag/module-auth/internal/model"
	"go-doudou-rag/module-auth/transport/httpsrv"
	"google.golang.org/grpc"
	"gorm.io/gorm"
	"os"
)

var _ plugin.ServicePlugin = (*ModuleAuthPlugin)(nil)

type ModuleAuthPlugin struct {
	grpcConns []*grpc.ClientConn
}

func (receiver *ModuleAuthPlugin) Close() {
	for _, item := range receiver.grpcConns {
		item.Close()
	}
}

func (receiver *ModuleAuthPlugin) GoDoudouServicePlugin() {

}

func (receiver *ModuleAuthPlugin) GetName() string {
	name := os.Getenv("GDD_SERVICE_NAME")
	if stringutils.IsEmpty(name) {
		name = "cloud.unionj.ModuleAuth"
	}
	return name
}

func (receiver *ModuleAuthPlugin) Initialize(restServer *rest.RestServer, grpcServer *grpcx.GrpcServer, dialCtx pipeconn.DialContextFunc) {
	conf := config.LoadFromEnv()

	db, err := gorm.Open(sqlite.Open(conf.Db.Dsn), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}

	if err = db.AutoMigrate(&model.User{}); err != nil {
		panic(err)
	}

	dao.Use(db)
	dao.Init()

	svc := service.NewModuleAuth(conf)
	routes := httpsrv.Routes(httpsrv.NewModuleAuthHandler(svc))
	restServer.GroupRoutes("/moduleauth", routes)
	restServer.GroupRoutes("/moduleauth", rest.DocRoutes(service.Oas))
}

func init() {
	plugin.RegisterServicePlugin(&ModuleAuthPlugin{})
}
```

### 5.8 生成HTTP相关代码

现在，我们需要生成HTTP相关的代码。在`module-auth`目录下执行：

```bash
go-doudou svc http --case snake
```

这个命令会根据`svc.go`中定义的接口，生成HTTP路由、处理器和OpenAPI文档。

## 6. 创建和集成其他模块

按照类似的步骤，创建知识库模块和聊天模块：

```bash
# 创建知识库模块
go-doudou svc init module-knowledge -m go-doudou-rag/module-knowledge --module --case snake -t rest

# 创建聊天模块
go-doudou svc init module-chat -m go-doudou-rag/module-chat --module --case snake -t rest
```

为每个模块定义服务接口、实现服务逻辑、配置插件等。以下是一个知识库模块的服务接口示例：

```go
package service

import (
	"context"
	v3 "github.com/unionj-cloud/toolkit/openapi/v3"
	"go-doudou-rag/module-knowledge/dto"
)

//go:generate go-doudou svc http --case snake

type ModuleKnowledge interface {
	Upload(ctx context.Context, file v3.FileModel) (data dto.UploadResult, err error)
	GetList(ctx context.Context) (data []dto.FileDTO, err error)
	GetQuery(ctx context.Context, req dto.QueryReq) (data []dto.QueryResult, err error)
}
```

## 7. 模块间通信

微内核架构应用中，模块之间需要进行通信。go-doudou提供了两种主要的通信方式：直接导入和依赖注入。

### 7.1 通过直接导入

```go
package service

import (
    "context"
    knowledge "go-doudou-rag/module-knowledge"
    "go-doudou-rag/module-chat/dto"
)

func (receiver *ModuleChatImpl) Chat(ctx context.Context, req dto.ChatRequest) (err error) {
    // 直接导入知识库模块的服务接口
    knowService := knowledge.NewModuleKnowledge(knowConf)
    queryResults, err := knowService.GetQuery(ctx, knowledge.QueryReq{
        Text: req.Prompt,
        Top:  10,
    })
    
    // 处理结果...
}
```

### 7.2 通过依赖注入

更推荐的方式是使用依赖注入，这可以使模块之间的耦合更加松散：

```go
// 在知识库模块的plugin/plugin.go文件中注册服务
func init() {
    plugin.RegisterServicePlugin(&ModuleKnowledgePlugin{})

    do.Provide[service.ModuleKnowledge](nil, func(injector *do.Injector) (service.ModuleKnowledge, error) {
        conf := config.LoadFromEnv()
        
        // 初始化数据库...
        
        svc := service.NewModuleKnowledge(conf)
        return svc, nil
    })
}

// 在聊天模块中使用依赖注入获取服务
import (
    "github.com/samber/do"
    know "go-doudou-rag/module-knowledge"
)

func (receiver *ModuleChatImpl) Chat(ctx context.Context, req dto.ChatRequest) (err error) {
    // 使用依赖注入获取知识库服务
    knowService := do.MustInvoke[know.ModuleKnowledge](nil)
    queryResults, err := knowService.GetQuery(ctx, know.QueryReq{
        Text: req.Prompt,
        Top:  10,
    })
    
    // 处理结果...
}
```

## 8. 配置管理

go-doudou微内核架构应用使用分层的配置管理方式，结合了配置文件和环境变量。

### 8.1 创建中央配置文件

在工作空间根目录创建`app.yml`文件：

```yaml
toolkit:
  auth:
    jwt-secret: "my-jwt-secret"
    jwt-expires-in: "12h"

moduleauth:
  db:
#    dsn: ":memory:"
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

### 8.2 环境变量覆盖

go-doudou允许通过环境变量覆盖配置文件中的值：

```bash
# JWT密钥
export TOOLKIT_AUTH_JWTSECRET="awesome-jwt-secret"

# JWT密钥过期时间
export TOOLKIT_AUTH_JWTEXPIRESIN="24h"

# 数据库连接字符串
export MODULEAUTH_DB_DSN="/data/production/auth.db"
```

环境变量名的构成规则是：模块前缀（大写）+ 下划线 + 配置路径（大写，用下划线分隔），ymal格式配置中的中横线在环境变量里需去掉。

使用示例：
```
TOOLKIT_AUTH_JWTEXPIRESIN=24h TOOLKIT_AUTH_JWTSECRET=awesome-jwt-secret go run cmd/main.go
```

## 9. 运行和测试

### 9.1 运行整个应用

在工作空间根目录执行：

```bash
cd main
go run cmd/main.go
```

这将启动主程序，加载所有注册的插件模块。

### 9.2 独立运行单个模块（用于开发）

每个模块都可以独立运行，这在开发阶段非常有用：

```bash
cd module-auth
go run cmd/main.go
```

独立运行时，模块会启动自己的HTTP服务器，而不会加载其他模块。未来需要扩展成微服务架构的时候，可以轻松实现架构升级。

### 9.3 生成API文档

go-doudou自动为每个模块生成OpenAPI 3.0规范文档，可以通过以下URL访问：

- 主应用（文档首页）：`http://localhost:6060/go-doudou/doc`
- 认证模块：`http://localhost:6060/moduleauth/go-doudou/doc`
- 知识库模块：`http://localhost:6060/modulechat/go-doudou/doc`
- 聊天模块：`http://localhost:6060/moduleknowledge/go-doudou/doc`

具体如何自定义OpenAPI 3.0规范的文档说明，请参考go-doudou官方文档 [接口定义](https://go-doudou.github.io/zh/guide/idl.html) 一节。

## 10. 最佳实践

1. **模块划分**: 根据业务领域划分模块，确保每个模块具有明确的责任边界
2. **接口先行**: 先定义服务接口，再实现业务逻辑
3. **依赖注入**: 使用依赖注入管理服务实例，减少硬编码依赖
4. **配置外部化**: 将所有配置参数外部化，便于不同环境部署
5. **独立测试**: 每个模块应能独立测试，减少依赖复杂度
6. **版本管理**: 为模块定义明确的版本策略，特别是模块间接口变更时
7. **错误处理**: 模块内部应妥善处理错误，避免将底层错误直接暴露给调用者

## 11. 进阶功能

### 11.1 自定义插件注册

有时我们需要更精细地控制插件的初始化过程：

```go
func (receiver *ModuleChatPlugin) Initialize(restServer *rest.RestServer, grpcServer *grpcx.GrpcServer, dialCtx pipeconn.DialContextFunc) {
	conf := config.LoadFromEnv()
	svc := service.NewModuleChat(conf)
	routes := httpsrv.Routes(httpsrv.NewModuleChatHandler(svc))

  // httpsrv.InjectResponseWriter是一个自定义路由中间件，针对以/modulechat开头的一组路由生效
	restServer.GroupRoutes("/modulechat", routes, httpsrv.InjectResponseWriter)
	restServer.GroupRoutes("/modulechat", rest.DocRoutes(service.Oas))
}
```

### 11.2 自定义服务注册

依赖注入时可以使用不同的作用域：

```go
// 单例模式
do.Provide[service.ModuleKnowledge](nil, func(injector *do.Injector) (service.ModuleKnowledge, error) {
    // ...
})

// 请求作用域（每次请求创建新实例）
do.ProvideNamed[service.ModuleKnowledge]("request", nil, func(injector *do.Injector) (service.ModuleKnowledge, error) {
    // ...
})

// 使用命名注入
knowService := do.MustInvokeNamed[know.ModuleKnowledge]("request", nil)
```

## 总结

通过本文的详细指南，我们展示了如何使用go-doudou从零构建一个微内核架构应用。这种架构模式具有高度的模块化和可扩展性，非常适合微内核系统和大型应用的开发。

go-doudou的CLI工具和插件机制大大简化了微内核架构的实现，让开发者可以专注于业务逻辑，而不必过多关注基础设施的搭建。通过遵循本文介绍的开发流程和最佳实践，您可以快速掌握基于go-doudou构建微内核架构应用的方法。

目前的使用方式是基于命令行或者postman的，在《go-doudou + langchaingo 微内核架构RAG大模型知识库实战（三）》中，我们将加上基于vue 3实现的对话界面，且将前端资源打包编译进聊天模块，实现全栈式开发和轻量化部署。