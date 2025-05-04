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
import { computed, h, ref, watch, onUnmounted, onMounted } from 'vue'
import { uploadService } from '@/api_know/UploadService'
import { TokenService } from '@/httputil/TokenService'

const { token } = theme.useToken()

const styles = computed(() => {
  return {
    'layout': {
      'width': '100%',
      'min-width': '1000px',
      'height': '722px',
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

const roles: BubbleListProps['roles'] = {
  ai: {
    placement: 'start',
    typing: {
      step: 2,           // 每次添加2个字符
      interval: 30,      // 每30毫秒添加一次
      suffix: h('span', { style: { marginLeft: '2px', animation: 'cursor-blink 0.8s infinite' } }, '|') // 添加闪烁光标
    },
    styles: {
      content: {
        borderRadius: '16px',
        padding: '12px 16px',
        fontSize: '14px',
        lineHeight: '1.5',
      },
    },
    // 自定义loading样式
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
const agentRequestLoading = ref(false)
const abortController = ref<AbortController | null>(null)

// 清理函数
onUnmounted(() => {
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

    try {
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
        body: JSON.stringify({ prompt: message }),
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
        stream.cancel()
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

watch(activeKey, () => {
  if (activeKey.value !== undefined) {
    setMessages([])
  }
}, { immediate: true })

// ==================== Event ====================
function onSubmit(nextContent: string) {
  if (!nextContent)
    return

  // 发送消息，会自动显示loading状态的AI消息
  onRequest(nextContent)
  content.value = ''
}

// 取消流式输出
function onCancel() {
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
}

const onConversationClick: ConversationsProps['onActiveChange'] = (key) => {
  activeKey.value = key
}

const handleFileChange: AttachmentsProps['onChange'] = info => {
  attachedFiles.value = info.fileList

  // 如果是上传文件操作
  if (info.file.status === 'done') {
    message.success(`${info.file.name} 上传成功`);
  } else if (info.file.status === 'error') {
    message.error(`${info.file.name} 上传失败`);
  }
}

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

const items = computed<BubbleListProps['items']>(() => {
  return messages.value.map(({ id, message, status }) => {
    return {
      key: id,
      loading: status === 'loading',
      role: status === 'local' ? 'local' : 'ai',
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
</style>
