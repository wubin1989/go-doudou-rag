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

const { token } = theme.useToken()

const styles = computed(() => {
  return {
    'layout': {
      'width': '100%',
      'min-width': '1000px',
      'height': '100vh',
      'border-radius': `${token.value.borderRadius}px`,
      'display': 'flex',
      'background': `${token.value.colorBgContainer}`,
      'font-family': `AlibabaPuHuiTi, ${token.value.fontFamily}, sans-serif`,
    },
    'menu': {
      'background': `${token.value.colorBgLayout}80`,
      'width': '280px',
      'height': '100%',
      'display': 'flex',
      'flex-direction': 'column',
    },
    'conversations': {
      'padding': '0 12px',
      'flex': 1,
      'overflow-y': 'auto',
    },
    'chat': {
      'height': '100%',
      'width': '100%',
      'max-width': '700px',
      'margin': '0 auto',
      'box-sizing': 'border-box',
      'display': 'flex',
      'flex-direction': 'column',
      'padding': `${token.value.paddingLG}px`,
      'gap': '16px',
    },
    'messages': {
      flex: 1,
      overflow: 'auto',
      maxHeight: 'calc(100vh - 150px)',
    },
    'placeholder': {
      'padding-top': '32px',
      'text-align': 'left',
      'flex': 1,
    },
    'sender': {
      'box-shadow': token.value.boxShadow,
    },
    'logo': {
      'display': 'flex',
      'height': '72px',
      'align-items': 'center',
      'justify-content': 'start',
      'padding': '0 24px',
      'box-sizing': 'border-box',
    },
    'logo-img': {
      width: '24px',
      height: '24px',
      display: 'inline-block',
    },
    'logo-span': {
      'display': 'inline-block',
      'margin': '0 8px',
      'font-weight': 'bold',
      'color': token.value.colorText,
      'font-size': '16px',
    },
    'addBtn': {
      background: '#1677ff0f',
      border: '1px solid #1677ff34',
      width: 'calc(100% - 24px)',
      margin: '0 12px 24px 12px',
    },
  } as const
})

defineOptions({ name: 'PlaygroundIndependentSetup' })

const defaultConversationsItems = [
  {
    key: '0',
    label: 'What is Ant Design X?',
  },
]

// 自定义渲染 Markdown 内容的函数
const renderMarkdown = (content: string) => {
  if (!content) return ''
  return md.render(content)
}

const roles: BubbleListProps['roles'] = {
  ai: {
    placement: 'start',
    typing: false,
    styles: {
      content: {
        borderRadius: '16px',
        padding: '12px 16px',
        fontSize: '14px',
        lineHeight: '1.5',
      },
    },
    loadingRender: () => h('div', { 
      style: { 
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center'
      } 
    }, [
      h('span', { 
        style: { 
          display: 'inline-block',
          width: '8px',
          height: '8px',
          marginRight: '4px',
          borderRadius: '50%',
          background: '#1890ff',
          animation: 'dot-pulse 1.5s infinite ease-in-out'
        } 
      }),
      h('span', { 
        style: { 
          display: 'inline-block',
          width: '8px',
          height: '8px',
          marginRight: '4px',
          borderRadius: '50%',
          background: '#1890ff',
          animation: 'dot-pulse 1.5s infinite ease-in-out 0.5s'
        } 
      }),
      h('span', { 
        style: { 
          display: 'inline-block',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#1890ff',
          animation: 'dot-pulse 1.5s infinite ease-in-out 1s'
        } 
      })
    ])
  },
  local: {
    placement: 'end',
    variant: 'shadow',
    styles: {
      content: {
        padding: '12px 16px',
      },
    },
  },
}

// ==================== State ====================
const headerOpen = ref(false)
const content = ref('')
const conversationsItems = ref(defaultConversationsItems)
const activeKey = ref(defaultConversationsItems[0].key)
const attachedFiles = ref<AttachmentsProps['items']>([])
const uploadedFileIds = ref<string[]>([]) // 存储已上传文件的ID列表
const agentRequestLoading = ref(false)
const abortController = ref<AbortController | null>(null)
// 移除对流的全局引用，改为依赖AbortController
const isRequestCancelled = ref(false) // 跟踪请求是否被取消
// 添加字典来跟踪每条消息的打字效果状态
const typingCompleted = ref<Record<string, boolean>>({})

// 清理函数
onUnmounted(() => {
  // 确保取消所有进行中的请求
  if (abortController.value) {
    abortController.value.abort()
  }
})

// ==================== Runtime ====================
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
      } finally {
        // 不尝试取消流，因为流可能是锁定状态
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

const { onRequest, messages, setMessages } = useXChat({
  agent: agent.value,
  requestFallback: '发送消息失败，请稍后重试',
  requestPlaceholder: '思考中...',  // 添加加载中的占位文本
})

// ==================== Event ====================
// 清除文件列表和文件ID
function clearAttachments() {
  attachedFiles.value = [];
  uploadedFileIds.value = [];
  headerOpen.value = false;
}

watch(activeKey, () => {
  if (activeKey.value !== undefined) {
    setMessages([])
    clearAttachments() // 切换会话时清除文件
  }
}, { immediate: true })

function onSubmit(nextContent: string) {
  if (!nextContent)
    return

  // 发送消息，会自动显示loading状态的AI消息
  onRequest(nextContent)
  content.value = ''
}

// 取消流式输出
function onCancel() {
  // 设置取消标志
  isRequestCancelled.value = true
  
  // 取消请求
  if (abortController.value) {
    abortController.value.abort()
  }
}

function onAddConversation() {
  conversationsItems.value = [
    ...conversationsItems.value,
    {
      key: `${conversationsItems.value.length}`,
      label: `New Conversation ${conversationsItems.value.length}`,
    },
  ]
  activeKey.value = `${conversationsItems.value.length}`
  clearAttachments() // 创建新会话时清除文件
}

const onConversationClick: ConversationsProps['onActiveChange'] = (key) => {
  activeKey.value = key
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

// 定义消息格式接口，确保类型安全
interface ChatMessage {
  id: string;
  message: string;
  status: 'success' | 'loading' | 'local' | 'error';
}

// ==================== Mounting ====================
onMounted(() => {
  // 显示默认欢迎消息 
  setTimeout(() => {
    // 添加一条AI欢迎消息
    const welcomeMessage: ChatMessage = {
      id: 'welcome-message',
      message: '请问有什么可以帮到您？',
      status: 'success' // 成功状态对应AI消息
    };
    setMessages([welcomeMessage]);
  }, 500); // 稍微延迟显示，让界面先加载完成
})
</script>

<template>
  <div :style="styles.layout">
    <div :style="styles.menu">
      <!-- 🌟 Logo -->
      <div :style="styles.logo">
        <img
          src="https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original"
          draggable="false"
          alt="logo"
          :style="styles['logo-img']"
        >
        <span :style="styles['logo-span']">Ant Design X Vue</span>
      </div>

      <!-- 🌟 添加会话 -->
      <Button
        type="link"
        :style="styles.addBtn"
        @click="onAddConversation"
      >
        <PlusOutlined />
        New Conversation
      </Button>

      <!-- 🌟 会话管理 -->
      <Conversations
        :items="conversationsItems"
        :style="styles.conversations"
        :active-key="activeKey"
        @active-change="onConversationClick"
      />
    </div>

    <div :style="styles.chat">
      <!-- 🌟 消息列表 -->
      <Bubble.List
        :items="items"
        :roles="roles"
        :style="styles.messages"
      />

      <!-- 🌟 输入框 -->
      <Sender
        :value="content"
        :style="styles.sender"
        :loading="agentRequestLoading"
        @submit="onSubmit"
        @change="value => content = value"
        @cancel="onCancel"
      >
        <template #prefix>
          <Badge :dot="attachedFiles.length > 0 && !headerOpen">
            <Button
              type="text"
              @click="() => headerOpen = !headerOpen"
            >
              <template #icon>
                <PaperClipOutlined />
              </template>
            </Button>
          </Badge>
        </template>

        <template #header>
          <Sender.Header
            title="Attachments"
            :open="headerOpen"
            :styles="{ content: { padding: 0 } }"
            @open-change="open => headerOpen = open"
          >
            <Attachments
              :before-upload="() => true"
              :custom-request="({ file, onSuccess, onError }) => {
                handleUpload(file)
                  .then(res => {
                    onSuccess(res);
                  })
                  .catch(err => {
                    onError(err);
                  });
              }"
              :items="attachedFiles"
              @change="handleFileChange"
            >
              <template #placeholder="type">
                <Flex
                  v-if="type && type.type === 'inline'"
                  align="center"
                  justify="center"
                  vertical
                  gap="2"
                >
                  <Typography.Text style="font-size: 30px; line-height: 1;">
                    <CloudUploadOutlined />
                  </Typography.Text>
                  <Typography.Title
                    :level="5"
                    style="margin: 0; font-size: 14px; line-height: 1.5;"
                  >
                    Upload files
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    Click or drag files to this area to upload
                  </Typography.Text>
                </Flex>
                <Typography.Text v-if="type && type.type === 'drop'">
                  Drop file here
                </Typography.Text>
              </template>
            </Attachments>
          </Sender.Header>
        </template>
      </Sender>
    </div>
  </div>
</template>

<style>
@keyframes cursor-blink {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }
}

@keyframes dot-pulse {
  0%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 全局样式 */
html, body {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
}

#app {
  height: 100%;
  width: 100%;
}

/* Markdown 样式 */
.markdown-content {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol',
    'Noto Color Emoji';
  line-height: 1.6;
  word-wrap: break-word;
}

.markdown-content h1 {
  font-size: 2em;
  margin-top: 0.67em;
  margin-bottom: 0.67em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-content h2 {
  font-size: 1.5em;
  margin-top: 0.83em;
  margin-bottom: 0.83em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-content h3 {
  font-size: 1.17em;
  margin-top: 1em;
  margin-bottom: 1em;
}

.markdown-content h4 {
  font-size: 1em;
  margin-top: 1.33em;
  margin-bottom: 1.33em;
}

.markdown-content h5 {
  font-size: 0.83em;
  margin-top: 1.67em;
  margin-bottom: 1.67em;
}

.markdown-content h6 {
  font-size: 0.67em;
  margin-top: 2.33em;
  margin-bottom: 2.33em;
}

.markdown-content blockquote {
  border-left: 4px solid #ddd;
  padding: 0 1em;
  color: #666;
  margin: 0.8em 0;
  background-color: #f6f8fa;
  border-radius: 3px;
}

.markdown-content pre {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  overflow: auto;
  margin: 0.8em 0;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.markdown-content code {
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
  background-color: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  overflow-wrap: break-word;
}

.markdown-content pre code {
  padding: 0;
  background-color: transparent;
  font-size: 0.85em;
  display: block;
  line-height: 1.45;
}

/* shiki 代码高亮样式 */
.shiki {
  background-color: transparent !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 0 !important;
  overflow: visible !important;
}

.markdown-content pre:has(.shiki) {
  background-color: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow: auto;
}

.markdown-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  display: block;
  overflow-x: auto;
}

.markdown-content table th,
.markdown-content table td {
  border: 1px solid #ddd;
  padding: 8px 13px;
}

.markdown-content table tr {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.markdown-content table tr:nth-child(2n) {
  background-color: #f6f8fa;
}

.markdown-content th {
  padding: 8px 16px;
  text-align: left;
  font-weight: 600;
  background-color: #f6f8fa;
}

.markdown-content img {
  max-width: 100%;
  box-sizing: content-box;
  display: block;
  margin: 0.8em auto;
}

.markdown-content p {
  margin: 0.5em 0 1em;
}

.markdown-content ul, .markdown-content ol {
  padding-left: 2em;
  margin: 0.5em 0 1em;
}

.markdown-content li + li {
  margin-top: 0.25em;
}

.markdown-content a {
  color: #1890ff;
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}

.markdown-content hr {
  height: .25em;
  padding: 0;
  margin: 24px 0;
  background-color: #e1e4e8;
  border: 0;
}

/* 代码块样式 */
.markdown-content .code-block {
  background-color: #f6f8fa;
  border-radius: 6px;
  padding: 16px;
  margin: 0.8em 0;
  position: relative;
  overflow-x: auto;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
}

.markdown-content .code-block code {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  font-size: 0.85em;
  line-height: 1.45;
  overflow-wrap: normal;
  white-space: pre;
  display: block;
}

/* 语言标签 */
.markdown-content .code-block:before {
  content: attr(class);
  display: block;
  position: absolute;
  top: 0;
  right: 0;
  padding: 2px 8px;
  font-size: 0.7em;
  color: #6a737d;
  background: #f1f1f1;
  border-radius: 0 6px 0 6px;
}

/* 内联代码样式 */
.markdown-content code:not(.code-block code) {
  background-color: rgba(175, 184, 193, 0.2);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
}

/* 打字机效果样式 */
.typing-container {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans', sans-serif;
  line-height: 1.6;
  word-wrap: break-word;
}

.typing-cursor {
  display: inline-block;
  opacity: 1;
  margin-left: 2px;
  animation: cursor-blink 0.8s infinite;
}

@keyframes cursor-blink {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
</style>
