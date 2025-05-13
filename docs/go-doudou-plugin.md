# go-doudou + langchaingo 微内核架构RAG大模型知识库实战（一）

![programming.jpg](https://p0-xtjj-private.juejin.cn/tos-cn-i-73owjymdk6/d92174f990f54302a3c095b979fb793a~tplv-73owjymdk6-jj-mark-v1:0:0:0:0:5o6Y6YeR5oqA5pyv56S-5Yy6IEAg5q2m5paM:q75.awebp?policy=eyJ2bSI6MywidWlkIjoiNDQ0MTY4MjcwNDYwNzUxNyJ9\&rk3s=e9ecf3d6\&x-orig-authkey=f32326d3454f2ac7e96d3d06cdbb035152127018\&x-orig-expires=1745945284\&x-orig-sign=Bmd60uK%2B0R5cAQqOYSNtq1C%2FGWk%3D)
Photo by <a href="https://unsplash.com/@cgower?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Christopher Gower</a> on <a href="https://unsplash.com/photos/a-macbook-with-lines-of-code-on-its-screen-on-a-busy-desk-m_HRfLhgABo?utm_content=creditCopyText&utm_medium=referral&utm_source=unsplash">Unsplash</a>
      
在现代微服务架构设计中，模块化和可插拔的设计模式越来越受到开发者的青睐。go-doudou作为一款国产的Go语言微服务框架，提供了优秀的插件机制和模块化架构支持。本文将通过一个基于RAG（检索增强生成）的实际项目来详细讲解go-doudou的插件机制和模块化微内核架构的实现方式。

## 1. 什么是插件机制和微内核架构

微内核架构（MicroKernel Architecture）也称为插件架构（Plugin Architecture），是一种将核心系统功能与扩展功能分离的设计模式。在这种架构中：

- **核心系统**：提供基础服务和管理插件的机制
- **插件模块**：独立开发、独立部署，实现特定功能

这种架构的优势在于：

1. **高度模块化**：每个插件都是独立的功能单元
2. **可扩展性强**：可以无需修改核心系统来添加新功能
3. **低耦合**：各模块之间通过定义良好的接口通信
4. **灵活部署**：可以按需加载插件

## 2. go-doudou框架的插件机制

go-doudou框架通过实现`ServicePlugin`接口来支持插件机制。每个服务模块作为一个插件被注册到主应用中，实现了模块与核心系统的解耦。

让我们先看一下该项目中`main/cmd/main.go`的核心代码：

```go
package main

import (
	"go-doudou-rag/toolkit/auth"
	"github.com/unionj-cloud/go-doudou/v2/framework/grpcx"
	"github.com/unionj-cloud/go-doudou/v2/framework/plugin"
	"github.com/unionj-cloud/go-doudou/v2/framework/rest"
	"github.com/unionj-cloud/toolkit/pipeconn"
	"github.com/unionj-cloud/toolkit/zlogger"
	"google.golang.org/grpc"

	_ "go-doudou-rag/module-auth/plugin"
	_ "go-doudou-rag/module-chat/plugin"
	_ "go-doudou-rag/module-knowledge/plugin"
)

func main() {
	srv := rest.NewRestServer()
	srv.Use(auth.Jwt)

	grpcServer := grpcx.NewGrpcServer(
		// GRPC配置...
	)
	lis, dialCtx := pipeconn.NewPipeListener()
	plugins := plugin.GetServicePlugins()
	for _, key := range plugins.Keys() {
		value, _ := plugins.Get(key)
		value.Initialize(srv, grpcServer, dialCtx)
	}
	defer func() {
		if r := recover(); r != nil {
			zlogger.Info().Msgf("Recovered. Error: %v\n", r)
		}
		for _, key := range plugins.Keys() {
			value, _ := plugins.Get(key)
			value.Close()
		}
	}()
	go func() {
		grpcServer.RunWithPipe(lis)
	}()
	srv.AddRoutes(rest.DocRoutes(""))
	srv.Run()
}
```

这段代码展示了go-doudou的微内核架构实现：

1. 通过匿名导入(`_ "go-doudou-rag/module-xxx/plugin"`)各模块的plugin包
2. 获取所有注册的服务插件 `plugin.GetServicePlugins()`
3. 调用每个插件的`Initialize`方法，将REST服务器和gRPC服务器传入
4. 注册资源清理函数，确保在程序退出时调用插件的`Close`方法

## 3. 插件的实现与注册

每个模块通过实现`ServicePlugin`接口来成为一个插件。以`module-auth`模块为例：

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

这个插件实现了关键的接口方法：

- `GoDoudouServicePlugin()`: 标识接口方法
- `GetName()`: 返回插件名称
- `Initialize()`: 初始化插件，注册HTTP路由
- `Close()`: 释放资源

特别注意`init()`函数中的`plugin.RegisterServicePlugin()`，它将插件注册到全局插件注册表中，使得主应用能够发现并加载这个插件。

## 4. 模块间的通信

在微内核架构中，模块间通信是关键挑战之一。go-doudou提供了多种通信方式：

1. **直接依赖调用**：模块可以直接导入其他模块的接口
2. **依赖注入**：通过`samber/do`库实现依赖注入

在`module-chat`的实现中，我们可以看到如何调用`module-knowledge`的服务：

```go
func (receiver *ModuleChatImpl) Chat(ctx context.Context, req dto.ChatRequest) (err error) {
	// ...省略部分代码...

	knowService := do.MustInvoke[know.ModuleKnowledge](nil)
	queryResults, err := knowService.GetQuery(ctx, kdto.QueryReq{
		Text: req.Prompt,
		Top:  10,
	})
	
	// ...省略部分代码...
}
```

`module-knowledge`通过依赖注入注册服务：

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

## 5. 模块化设计的实践

该项目展示了模块化设计的最佳实践，每个模块有清晰的职责划分：

1. **Module-Auth**: 负责用户认证
2. **Module-Chat**: 实现聊天功能，集成大语言模型
3. **Module-Knowledge**: 知识库管理，实现RAG检索

每个模块都遵循相似的内部结构：

```
module-xxx/
  ├── cmd/              # 独立运行入口
  ├── config/           # 模块配置
  ├── dto/              # 数据传输对象
  ├── internal/         # 内部实现
  │   ├── dao/          # 数据访问
  │   └── model/        # 数据模型
  ├── plugin/           # 插件实现
  ├── transport/        # 传输层
  │   └── httpsrv/      # HTTP服务
  ├── svc.go            # 服务接口定义
  └── svcimpl.go        # 服务实现
```

这种结构保证了：

1. 接口与实现分离
2. 关注点分离
3. 清晰的依赖关系
4. 良好的封装性

## 6. 实战案例：RAG聊天系统

这个项目实现了一个基于RAG（检索增强生成）的聊天系统，整体流程如下：

1. 用户通过`module-auth`进行认证
2. 认证后可以通过`module-knowledge`上传知识文档
3. 用户通过`module-chat`提问，系统会：
   - 从`module-knowledge`检索相关内容
   - 调用大语言模型生成答案
   - 使用SSE（Server-Sent Events）流式返回结果

例如，`module-chat`中的核心处理逻辑：

```go
func (receiver *ModuleChatImpl) Chat(ctx context.Context, req dto.ChatRequest) (err error) {
	// ...设置响应头...

	// 创建LLM客户端
	llm, err := openai.New(
		openai.WithBaseURL(receiver.conf.Openai.BaseUrl),
		openai.WithToken(lo.Ternary(stringutils.IsNotEmpty(receiver.conf.Openai.Token), 
			receiver.conf.Openai.Token, os.Getenv("OPENAI_API_KEY"))),
		openai.WithEmbeddingModel(receiver.conf.Openai.EmbeddingModel),
		openai.WithModel(receiver.conf.Openai.Model),
	)
	
	// 从知识库检索相关内容
	knowService := do.MustInvoke[know.ModuleKnowledge](nil)
	queryResults, err := knowService.GetQuery(ctx, kdto.QueryReq{
		Text: req.Prompt,
		Top:  10,
	})
	
	// 过滤相关性高的结果
	queryResults = lo.Filter(queryResults, func(item kdto.QueryResult, index int) bool {
		return cast.ToFloat64(item.Similarity) >= 0.5
	})

	// 构建提示词
	prompt := "请结合下面给出的上下文信息回答问题..."
	
	// 调用LLM生成回答并流式返回
	content := []llms.MessageContent{
		llms.TextParts(llms.ChatMessageTypeSystem, "You are a senior public policy researcher."),
		llms.TextParts(llms.ChatMessageTypeHuman, prompt),
	}

	_, err = llm.GenerateContent(ctx, content,
		llms.WithMaxTokens(4096),
		llms.WithTemperature(0.2),
		llms.WithStreamingFunc(func(ctx context.Context, chunk []byte) error {
			chunkResp := dto.ChatResponse{
				Content:   string(chunk),
				RequestID: requestID,
				Type:      "content",
			}
			return writeSSEMessage(w, flusher, chunkResp)
		}))
		
	return
}
```

## 7. 系统启动与使用示例

### 7.1 启动系统

通过以下步骤启动此基于go-doudou插件架构的RAG系统：

1. **克隆代码库并进入项目目录**
   ```bash
   git clone https://github.com/your-repo/go-doudou-rag.git
   cd go-doudou-rag
   ```

2. **安装依赖**
   ```bash
   go mod tidy
   ```

3. **启动主应用**
   ```bash
   cd main/cmd
   go run main.go
   ```

系统启动后，所有模块（auth、chat、knowledge）会作为插件被加载，各自的API端点也会被注册到主应用中。

### 7.2 调用示例

下面展示如何使用curl命令向聊天服务发送请求，实现基于知识库的问答：

```bash
# 登录
curl --location 'http://localhost:6060/moduleauth/login' \
--header 'Content-Type: application/json' \
--data '{
    "username": "admin",
    "password": "admin"
}'

# 上传pdf文档
curl --location 'http://localhost:6060/moduleknowledge/upload' \
--header 'Authorization: Bearer <从登录接口获取的token>' \
--form 'file=@"/Users/wubin1989/Downloads/杭州市人民政府印发关于进一步推动经济高质量发展若干政策的通知.pdf"'

# 聊天
curl -w '\n' -N -X POST 'http://localhost:6060/modulechat/chat' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer <从登录接口获取的token>' \
--data '{
    "prompt": "最近杭州出台了什么经济相关的政策？"
}'
```

系统响应示例：

首先，系统会返回构建的提示词（包含从知识库检索到的上下文信息）：

```
请结合下面给出的上下文信息回答问题，答案必须分条阐述，力求条理清晰，如果不知道可以回答不知道，但不要编造答案：
1. — 1 —
杭州市人民政府文件
杭政函〔2024〕16 号
杭州市人民政府印发关于进一步推动
经济高质量发展若干政策的通知
各区、县（市）人民政府，市政府各部门、各直属单位：
现将《关于进一步推动经济高质量发展的若干政策》印发给
你们，请结合实际认真组织实施。
杭州市人民政府
2024 年 2 月 18 日
（此件公开发布）
ZJAC00-2024-0001
2. — 2 —
关于进一步推动经济高质量发展的若干政策
... [省略部分上下文] ...
```

然后，系统会基于检索到的上下文信息，生成结构化的回答：

```
根据提供的信息，杭州市人民政府最近出台了一系列推动经济高质量发展的政策，具体包括以下几个方面：

1. **扩大有效投资政策**：推动《杭州市政府投资项目管理条例》出台，落实省扩大有效投资"千项万亿"工程，2024年计划完成投资800亿元以上，带动固定资产投资增长3%。

2. **激发消费潜能**：落实新能源汽车减免购置税等政策，全年新增公共领域充电设施3000个，组织促消费活动500场以上，举办餐饮促消费活动50场以上。

3. **支持企业高质量发展**：完善优质企业梯度培育机制，对首次上规纳统的工业企业给予最高20万元的一次性奖励，上规后连续3年保持在规的再给予不超过30万元的一次性奖励。

4. **稳定外贸发展**：全年组织不少于150个外贸团组，参加100个以上境外展会，3000家次企业赴境外拓市场，提高企业短期出口信用保险的投保费资助比例上限至60%（制造业企业上限提高至65%）。

5. **打造国际会展之都**：高质量办好第三届全球数字贸易博览会，实现五个翻番，2024年招引30场展览落户杭州国博中心和大会展中心。

6. **支持数字贸易发展**：鼓励企业开展数据出境安全评估，参与制定数字贸易领域各类标准，持续推动服务贸易创新发展。

7. **发挥电商优势**：推进杭州市新电商高质量发展，全年累计打造电商直播式"共富工坊"不少于200家，深化杭州跨境电商综试区建设。

8. **强化财政资金支持**：市财政2024年预算安排6亿元，用于支持扩大内需促消费领域，支持外贸发展、新电商高质量发展、跨境电商发展、新开国际航线等。
```

### 7.3 知识库检索失败的处理机制

RAG系统的一个重要特性是仅回答基于知识库中存在的信息，当用户提问的内容与知识库中的文档相关性不高或完全不相关时，系统会明确告知用户无法回答，而不是生成可能不准确的信息。以下是一个示例：

```bash
curl -w '\n' -N -X POST 'http://localhost:6060/modulechat/chat' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NDU4OTM4MTMsInVzZXJuYW1lIjoiYWRtaW4ifQ.EjxDfrMMHmOCvt557H8rd5sn9zX-uYOytw4OKH-jLJ8' \
--data '{
    "prompt": "Java的最新版本是哪个？"            
}'
```

系统响应：
```
非常抱歉，未能检索到相关信息，无法回答
```

在代码实现中，这个机制通过以下方式实现：

```go
// 从module-chat/svcimpl.go中的实现
queryResults = lo.Filter(queryResults, func(item kdto.QueryResult, index int) bool {
    return cast.ToFloat64(item.Similarity) >= 0.5
})

if len(queryResults) == 0 {
    zlogger.Error().Msgf("Knowledge not found, requestId: %s", requestID)
    chunk := dto.ChatResponse{
        Content:   "非常抱歉，未能检索到相关信息，无法回答",
        RequestID: requestID,
        Type:      "error",
    }
    writeSSEMessage(w, flusher, chunk)
    return
}
```

这个设计确保了系统只回答它有知识基础的问题，提高了回答的可靠性和准确性，避免了生成虚假信息的风险。它是负责任的AI应用设计的一个重要方面，尤其在需要高度准确性的领域如政策咨询、法律建议等方面尤为重要。

这个示例充分展示了插件架构的强大之处：
1. **模块协作**：`module-auth`处理认证，`module-knowledge`负责知识检索，`module-chat`集成大语言模型生成回答
2. **可插拔性**：各模块可独立更新或替换
3. **技术解耦**：每个模块可以使用不同的技术栈和数据存储方式

## 8. 总结与展望

本文通过一个实际的RAG聊天系统案例，详细介绍了go-doudou框架中的插件机制与模块化可插拔微内核架构。我们看到，这种架构模式不仅提供了良好的模块化和可扩展性，还使得系统各部分能够松耦合地协同工作，大大提高了开发效率和系统可维护性。

go-doudou框架的插件机制通过`ServicePlugin`接口和依赖注入系统，为开发者提供了一种简洁而强大的方式来构建模块化应用。这种方式特别适合于团队协作开发复杂系统，每个团队可以专注于自己的领域模块，而无需过多关注其他模块的实现细节。

然而，理解概念和原理只是第一步，如何从零开始实际构建这样的系统才是开发者最关心的问题。在下一篇文章《go-doudou框架中的插件机制与模块化可插拔微内核架构实战（二）》中，我们将提供一个详细的实战指南，带领读者一步步从零开始搭建一个完整的go-doudou微内核架构应用。我们将通过具体的命令和代码示例，展示如何使用go-doudou CLI工具创建工作空间、定义服务接口、实现插件、配置模块间通信等全流程操作，帮助开发者快速掌握这一强大架构模式的实际应用方法。

## 参考资料

- go-doudou官方文档：https://go-doudou.github.io/
- 本项目源码地址：https://github.com/wubin1989/go-doudou-rag