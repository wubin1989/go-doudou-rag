# go-doudou + langchaingo 微内核架构RAG大模型知识库实战（三）

在前两篇文章中，我们详细介绍了go-doudou框架的插件机制和微内核架构的实现方式，以及如何从零开始搭建一个基于go-doudou的微内核架构应用。本文将着重介绍项目的前端开发，特别是基于Vue 3的聊天界面如何开发，以及go-doudou框架如何将前端资源嵌入后端服务进行一体化部署。

## 1. 前端技术栈概览

本项目的前端采用了以下技术栈：

- **Vue 3**: 核心前端框架，使用Composition API进行开发
- **Ant Design Vue**: UI组件库，提供美观且功能丰富的组件
- **ant-design-x-vue**: 基于Ant Design Vue开发的聊天组件库
- **TypeScript**: 提供类型安全和更好的开发体验
- **Vite**: 现代化的前端构建工具，提供快速的开发体验

项目前端代码位于`module-chat/frontend`目录，结构清晰，方便开发和维护。

## 2. 聊天界面开发

### 2.1 界面设计与实现

聊天界面采用了经典的左右布局设计：左侧为会话列表，右侧为消息区域和输入框。整个界面基于ant-design-x-vue的组件库实现，提供了一致的用户体验。

核心聊天组件的实现如下（`module-chat/frontend/src/Demo.vue`）：

```vue
<script setup lang="ts">
import type { AttachmentsProps, BubbleListProps, ConversationsProps, PromptsProps } from 'ant-design-x-vue'
import type { VNode } from 'vue'
import {
  CloudUploadOutlined,
  CommentOutlined,
  EllipsisOutlined,
  FireOutlined,
  HeartOutlined,
  PaperClipOutlined,
  PlusOutlined,
  ReadOutlined,
  ShareAltOutlined,
  SmileOutlined,
} from '@ant-design/icons-vue'
import { Badge, Button, Flex, Space, Typography, theme, message } from 'ant-design-vue'
import {
  Attachments,
  Bubble,
  Conversations,
  Prompts,
  Sender,
  useXAgent,
  useXChat,
  Welcome,
  XStream,
} from 'ant-design-x-vue'
import { computed, h, ref, watch, onUnmounted, onMounted, nextTick, defineComponent } from 'vue'
import { uploadService } from '@/api_know/UploadService'
import { TokenService } from '@/httputil/TokenService'
import MarkdownIt from 'markdown-it'

// 创建markdown-it解析器
const md = new MarkdownIt({
  html: true,        // 启用HTML标签
  breaks: true,      // 转换'\n'为<br>
  linkify: true,     // 自动将URL转为链接
  highlight: (str, lang) => {
    // 简单代码高亮
    return `<pre class="code-block"><code class="${lang ? `language-${lang}` : ''}">${md.utils.escapeHtml(str)}</code></pre>`;
  }
});
```

### 2.2 技术亮点

#### 流式输出与打字机效果

本项目实现了流式响应和打字机效果，提升了用户体验。这是通过自定义的`TypingText`组件和服务端的SSE（Server-Sent Events）实现的：

```vue
// 自定义打字机组件
const TypingText = defineComponent({
  name: 'TypingText',
  props: {
    text: {
      type: String,
      required: true
    },
    speed: {
      type: Number,
      default: 30
    },
    onComplete: {
      type: Function,
      default: () => {}
    }
  },
  setup(props, { emit }) {
    const displayText = ref('');
    const isTyping = ref(true);
    const charIndex = ref(0);
    const blinkCursor = ref(true);
    
    // 打字效果
    const typeNextChar = () => {
      if (charIndex.value < props.text.length) {
        // 一次添加2个字符，加快速度
        const charsToAdd = Math.min(2, props.text.length - charIndex.value);
        displayText.value += props.text.substring(charIndex.value, charIndex.value + charsToAdd);
        charIndex.value += charsToAdd;
        
        setTimeout(typeNextChar, props.speed);
      } else {
        isTyping.value = false;
        blinkCursor.value = false;
        props.onComplete();
      }
    };
    
    // 监听text变化，重新开始打字
    watch(() => props.text, () => {
      displayText.value = '';
      charIndex.value = 0;
      isTyping.value = true;
      blinkCursor.value = true;
      
      if (props.text) {
        setTimeout(typeNextChar, props.speed);
      }
    }, { immediate: true });
    
    return () => {
      return h('div', { class: 'typing-container' }, [
        h('span', displayText.value),
        isTyping.value ? h('span', { 
          class: 'typing-cursor',
          style: {
            display: blinkCursor.value ? 'inline-block' : 'none',
            marginLeft: '2px',
            animation: 'cursor-blink 0.8s infinite'
          }
        }, '|') : null
      ]);
    };
  }
});
```

#### Markdown渲染与代码高亮

聊天界面支持Markdown格式的消息渲染，并提供代码高亮功能，使得复杂内容的展示更加清晰：

```vue
// 自定义渲染 Markdown 内容的函数
const renderMarkdown = (content: string) => {
  if (!content) return ''
  return md.render(content)
}

const items = computed<BubbleListProps['items']>(() => {
  return messages.value.map(({ id, message, status }) => {
    if (status !== 'local') {
      // 检查此消息是否已完成打字效果
      const isTypingDone = typingCompleted.value[id] || false;
      
      return {
        key: id,
        loading: status === 'loading',
        role: 'ai',
        // 指定content为HTML或纯文本
        content: isTypingDone 
          ? h('div', { 
              class: 'markdown-content',
              innerHTML: renderMarkdown(message)
            })
          : h(TypingText, { 
              text: message,
              onComplete: () => {
                typingCompleted.value[id] = true;
              }
            })
      }
    }
    
    return {
      key: id,
      loading: false,
      role: 'local',
      content: message,
    }
  })
})
```

#### 文件上传与知识库集成

前端实现了文件上传功能，支持将PDF文档上传到知识库，并基于这些文档进行问答：

```vue
// 上传文件的处理函数
const handleUpload = async (file: any) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await uploadService.postUpload(formData);
    return response;
  } catch (error) {
    return false;
  }
}

const handleFileChange: AttachmentsProps['onChange'] = info => {
  attachedFiles.value = info.fileList

  // 如果是上传文件操作
  if (info.file.status === 'done') {
    console.log("file done", info.file)

    // 检查响应中是否包含文件ID
    if (info.file.response && info.file.response.data && info.file.response.data.id) {
      // 如果文件已经上传成功并有ID，则添加到文件ID列表中
      uploadedFileIds.value.push(info.file.response.data.id);
    }

    message.success(`${info.file.name} 上传成功`);
  } else if (info.file.status === 'error') {
    message.error(`${info.file.name} 上传失败`);
  } else if (info.file.status === 'removed') {
    console.log("file removed", info.file)
    // 如果文件被移除，也需要从文件ID列表中移除
    if (info.file.response && info.file.response.data && info.file.response.data.id) {
      const fileId = info.file.response.data.id;
      uploadedFileIds.value = uploadedFileIds.value.filter(id => id !== fileId);
    }
  }
}
```

#### SSE流式通信实现

前端通过SSE（Server-Sent Events）技术实现与后端的流式通信，保证了实时性和资源利用效率：

```vue
const [agent] = useXAgent({
  request: async ({ message }, { onSuccess, onError }) => {
    agentRequestLoading.value = true

    // 如果有正在进行的请求，先取消
    if (abortController.value) {
      abortController.value.abort()
    }

    // 创建新的AbortController
    abortController.value = new AbortController()
    // 重置取消标志
    isRequestCancelled.value = false

    try {
      // 获取文件ID字符串，多个文件ID使用英文逗号拼接
      const fileIdStr = uploadedFileIds.value.join(',')
      
      // 发起SSE流式请求
      const response = await fetch(`/modulechat/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TokenService.getToken()}`,
          'Accept': 'text/event-stream', // 明确指定接受SSE
          'Connection': 'keep-alive', // 尝试保持连接
          'Cache-Control': 'no-cache' // 防止缓存
        },
        body: JSON.stringify({
          prompt: message,
          file_id: fileIdStr // 添加文件ID字段
        }),
        signal: abortController.value.signal,
        // 允许带上认证信息
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // 使用XStream处理流数据
      const stream = XStream({
        readableStream: response.body
      })
      
      // 收集完整内容
      let fullContent = ''

      try {
        // 使用stream迭代器处理数据块
        for await (const chunk of stream) {
          // 如果请求已被取消，不再处理数据
          if (isRequestCancelled.value) {
            break
          }

          try {
            if (!chunk || !chunk.data) continue

            // 解析SSE数据
            const data = JSON.parse(chunk.data)

            // 只收集内容，不进行中间更新，让Bubble的内置typing效果处理
            if (data.content) {
              fullContent += data.content
            }
          } catch (error) {
            console.error('Error parsing SSE data:', error)
          }
        }

        // 流结束后，返回完整内容，由Bubble组件以打字效果展示
        onSuccess(fullContent || '服务端没有返回有效内容')
      } catch (error) {
        console.error('Error reading stream:', error)
        throw error
      }
    } catch (error: any) {
      console.error('SSE错误:', error)

      if (error.name === 'AbortError') {
        onSuccess('对话已取消')
      } else if (error.message.includes('timeout') || error.message.includes('timedout')) {
        onSuccess('连接超时，请稍后重试')
      } else {
        onError(error)
      }
    } finally {
      agentRequestLoading.value = false
      abortController.value = null
    }
  },
})
```

## 3. go-doudou框架嵌入前端资源

### 3.1 前端资源的打包与集成

go-doudou框架提供了一种优雅的方式来嵌入前端资源，实现前后端一体化部署。这种方式避免了传统前后端分离部署的复杂性，特别适合中小型应用。

在本项目中，我们首先需要在前端项目目录下执行构建命令生成静态资源：

```bash
cd module-chat/frontend
npm run build
```

这个命令会在`module-chat/frontend/dist`目录下生成打包后的静态资源文件。然后，我们在`module-chat`模块的插件初始化代码中，使用`AddStaticResource`方法将这些静态资源嵌入到后端服务中。

### 3.2 AddStaticResource的使用与前端资源嵌入

为了实现前端资源的一体化打包，我们使用了Go 1.16+引入的`embed`包，这是一个强大的功能，允许将静态文件嵌入到Go二进制文件中。在`module-chat/frontend/embed.go`文件中，我们可以看到如何声明嵌入式文件系统：

```go
package frontend

import "embed"

//go:embed dist/*
var Dist embed.FS
```

`//go:embed dist/*`这个特殊的注释指令告诉Go编译器将`dist`目录下的所有文件嵌入到可执行文件中，并通过`Dist`变量提供访问。这种方式有以下优势：

1. 前端资源成为Go二进制的一部分，不需要额外的文件复制或部署
2. 分发更加简单，只需要分发一个二进制文件
3. 资源内容在编译时就确定，无需运行时查找文件

在`module-chat/plugin/plugin.go`文件中，我们可以看到如何使用这些嵌入的资源：

```go
func (receiver *ModuleChatPlugin) Initialize(restServer *rest.RestServer, grpcServer *grpcx.GrpcServer, dialCtx pipeconn.DialContextFunc) {
	dist_storage, _ := fs.Sub(frontend.Dist, "dist")
	restServer.AddStaticResource(dist_storage, "")

	conf := config.LoadFromEnv()
	svc := service.NewModuleChat(conf)
	routes := httpsrv.Routes(httpsrv.NewModuleChatHandler(svc))
	restServer.GroupRoutes("/modulechat", routes, httpsrv.InjectResponseWriter)
	restServer.GroupRoutes("/modulechat", rest.DocRoutes(service.Oas))
}
```

这段代码实现了关键功能：

1. 使用`fs.Sub`函数从嵌入的`frontend.Dist`中提取`dist`子目录，返回一个实现了`fs.FS`接口的新文件系统。
2. 调用`AddStaticResource`方法，将这个嵌入式文件系统映射到根路径`""`，而不是映射物理文件路径。这是go-doudou框架的一个强大特性，支持直接使用`fs.FS`接口。

### 3.3 前后端路由整合

在我们的项目中，前端路由和后端API路由需要和谐共存。我们使用Vue Router管理前端路由，并在`module-chat/frontend/src/router/index.ts`中定义了路由配置：

```typescript
import { createRouter, createWebHistory, createWebHashHistory, RouteRecordRaw } from 'vue-router';
import { TokenService } from '@/httputil/TokenService';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/demo',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/demo',
    name: 'Demo',
    component: () => import('@/Demo.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

// 路由守卫
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isLoggedIn = TokenService.isLoggedIn();

  if (requiresAuth && !isLoggedIn) {
    // 需要登录但用户未登录，重定向到登录页
    next({ name: 'Login' });
  } else if (to.path === '/login' && isLoggedIn) {
    // 已登录但访问登录页，重定向到首页
    next({ path: '/demo' });
  } else {
    next();
  }
});

export default router;
```

这里的关键是使用`createWebHashHistory()`创建了基于哈希的历史模式，这种模式在URL中使用`#`分隔前端路由，从而避免了与后端路由的冲突。例如，访问`/demo`路由实际会转换为`/#/demo`，这样服务器只需要处理`/`路径，而浏览器负责解析`#`后面的部分。

## 4. 编译与部署流程

### 4.1 前端资源构建

前端资源构建非常简单，只需在`module-chat/frontend`目录下执行：

```bash
npm install    # 仅首次构建或依赖变更时需要
npm run build
```

这个命令会在`module-chat/frontend/dist`目录下生成打包后的静态资源文件。由于我们使用了Go的`embed`包，这些构建产物会在Go编译时嵌入到二进制文件中。

### 4.2 项目启动与访问

构建前端资源后，可以直接在项目根目录下运行以下命令启动整个应用：

```bash
cd main && go run cmd/main.go
```

如果需要编译整个项目为一个可执行文件，只需执行：

```bash
go build main/cmd/main.go
```

编译后的二进制文件已经包含了所有前端资源，可以直接运行，无需任何额外的文件或配置。服务启动后，用户可以直接通过`http://localhost:6060`访问聊天界面。

这种一体化部署方式大大简化了运维工作，特别适合团队中没有专职前端运维人员的场景。整个应用只需要一个二进制文件即可运行，极大地降低了部署和分发的复杂性。

## 5. 总结与最佳实践

通过本文的介绍，我们详细讲解了基于Vue 3的聊天界面开发，以及如何使用go-doudou框架的`AddStaticResource`方法实现前后端一体化部署。这种集成方式具有以下优势：

1. **简化部署**：只需部署一个服务，无需分别部署前端和后端
2. **减少跨域问题**：前后端同源，避免了常见的跨域问题
3. **降低运维复杂度**：简化了运维流程和环境配置
4. **提升资源利用效率**：减少了服务实例数量，节约资源

在实际开发中，我们推荐以下最佳实践：

1. **保持前后端代码分离**：虽然部署一体化，但在开发阶段应保持前后端代码的清晰分离
2. **使用哈希路由模式**：避免前端路由与后端API路由冲突
3. **自动化构建流程**：通过Makefile或CI/CD流程自动化前后端构建
4. **优化静态资源**：对前端静态资源进行适当优化，减少首页加载时间
5. **缓存控制**：在生产环境中添加适当的缓存控制，提升用户体验

go-doudou框架的前后端一体化部署方案非常适合中小型团队快速开发和部署应用，特别是在资源有限或团队规模较小的情况下，这种方式可以显著提高开发效率和降低运维成本。

在未来的开发中，我们可以进一步探索如何在这个一体化架构基础上实现更丰富的功能，如国际化支持、主题定制、更复杂的状态管理等，使得这个基于go-doudou和Vue 3的聊天应用更加强大和灵活。 