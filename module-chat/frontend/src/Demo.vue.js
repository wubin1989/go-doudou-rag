import { CloudUploadOutlined, PaperClipOutlined, PlusOutlined, } from '@ant-design/icons-vue';
import { Badge, Button, Flex, Typography, theme, message } from 'ant-design-vue';
import { Attachments, Bubble, Conversations, Sender, useXAgent, useXChat, XStream, } from 'ant-design-x-vue';
import { computed, h, ref, watch, onUnmounted, onMounted, defineComponent } from 'vue';
import { uploadService } from '@/api_know/UploadService';
import { TokenService } from '@/httputil/TokenService';
import MarkdownIt from 'markdown-it';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
// 创建markdown-it解析器
const md = new MarkdownIt({
    html: true, // 启用HTML标签
    breaks: true, // 转换'\n'为<br>
    linkify: true, // 自动将URL转为链接
    highlight: (str, lang) => {
        // 简单代码高亮
        return `<pre class="code-block"><code class="${lang ? `language-${lang}` : ''}">${md.utils.escapeHtml(str)}</code></pre>`;
    }
});
const { token } = theme.useToken();
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
    };
});
defineOptions({ name: 'PlaygroundIndependentSetup' });
const defaultConversationsItems = [
    {
        key: '0',
        label: 'What is Ant Design X?',
    },
];
// 自定义渲染 Markdown 内容的函数
const renderMarkdown = (content) => {
    if (!content)
        return '';
    return md.render(content);
};
const roles = {
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
};
// ==================== State ====================
const headerOpen = ref(false);
const content = ref('');
const conversationsItems = ref(defaultConversationsItems);
const activeKey = ref(defaultConversationsItems[0].key);
const attachedFiles = ref([]);
const uploadedFileIds = ref([]); // 存储已上传文件的ID列表
const agentRequestLoading = ref(false);
const abortController = ref(null);
// 移除对流的全局引用，改为依赖AbortController
const isRequestCancelled = ref(false); // 跟踪请求是否被取消
// 添加字典来跟踪每条消息的打字效果状态
const typingCompleted = ref({});
// 清理函数
onUnmounted(() => {
    // 确保取消所有进行中的请求
    if (abortController.value) {
        abortController.value.abort();
    }
});
// ==================== Runtime ====================
const [agent] = useXAgent({
    request: async ({ message }, { onSuccess, onError }) => {
        agentRequestLoading.value = true;
        // 如果有正在进行的请求，先取消
        if (abortController.value) {
            abortController.value.abort();
        }
        // 创建新的AbortController
        abortController.value = new AbortController();
        // 重置取消标志
        isRequestCancelled.value = false;
        try {
            // 获取文件ID字符串，多个文件ID使用英文逗号拼接
            const fileIdStr = uploadedFileIds.value.join(',');
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
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            if (!response.body) {
                throw new Error('Response body is null');
            }
            // 使用XStream处理流数据
            const stream = XStream({
                readableStream: response.body
            });
            // 收集完整内容
            let fullContent = '';
            try {
                // 使用stream迭代器处理数据块
                for await (const chunk of stream) {
                    // 如果请求已被取消，不再处理数据
                    if (isRequestCancelled.value) {
                        break;
                    }
                    try {
                        if (!chunk || !chunk.data)
                            continue;
                        // 解析SSE数据
                        const data = JSON.parse(chunk.data);
                        // 只收集内容，不进行中间更新，让Bubble的内置typing效果处理
                        if (data.content) {
                            fullContent += data.content;
                        }
                    }
                    catch (error) {
                        console.error('Error parsing SSE data:', error);
                    }
                }
                // 流结束后，返回完整内容，由Bubble组件以打字效果展示
                onSuccess(fullContent || '服务端没有返回有效内容');
            }
            catch (error) {
                console.error('Error reading stream:', error);
                throw error;
            }
            finally {
                // 不尝试取消流，因为流可能是锁定状态
            }
        }
        catch (error) {
            console.error('SSE错误:', error);
            if (error.name === 'AbortError') {
                onSuccess('对话已取消');
            }
            else if (error.message.includes('timeout') || error.message.includes('timedout')) {
                onSuccess('连接超时，请稍后重试');
            }
            else {
                onError(error);
            }
        }
        finally {
            agentRequestLoading.value = false;
            abortController.value = null;
        }
    },
});
const { onRequest, messages, setMessages } = useXChat({
    agent: agent.value,
    requestFallback: '发送消息失败，请稍后重试',
    requestPlaceholder: '思考中...', // 添加加载中的占位文本
});
// ==================== Event ====================
// 清除文件列表和文件ID
function clearAttachments() {
    attachedFiles.value = [];
    uploadedFileIds.value = [];
    headerOpen.value = false;
}
watch(activeKey, () => {
    if (activeKey.value !== undefined) {
        setMessages([]);
        clearAttachments(); // 切换会话时清除文件
    }
}, { immediate: true });
function onSubmit(nextContent) {
    if (!nextContent)
        return;
    // 发送消息，会自动显示loading状态的AI消息
    onRequest(nextContent);
    content.value = '';
}
// 取消流式输出
function onCancel() {
    // 设置取消标志
    isRequestCancelled.value = true;
    // 取消请求
    if (abortController.value) {
        abortController.value.abort();
    }
}
function onAddConversation() {
    conversationsItems.value = [
        ...conversationsItems.value,
        {
            key: `${conversationsItems.value.length}`,
            label: `New Conversation ${conversationsItems.value.length}`,
        },
    ];
    activeKey.value = `${conversationsItems.value.length}`;
    clearAttachments(); // 创建新会话时清除文件
}
const onConversationClick = (key) => {
    activeKey.value = key;
};
const handleFileChange = info => {
    attachedFiles.value = info.fileList;
    // 如果是上传文件操作
    if (info.file.status === 'done') {
        console.log("file done", info.file);
        // 检查响应中是否包含文件ID
        if (info.file.response && info.file.response.data && info.file.response.data.id) {
            // 如果文件已经上传成功并有ID，则添加到文件ID列表中
            uploadedFileIds.value.push(info.file.response.data.id);
        }
        message.success(`${info.file.name} 上传成功`);
    }
    else if (info.file.status === 'error') {
        message.error(`${info.file.name} 上传失败`);
    }
    else if (info.file.status === 'removed') {
        console.log("file removed", info.file);
        // 如果文件被移除，也需要从文件ID列表中移除
        if (info.file.response && info.file.response.data && info.file.response.data.id) {
            const fileId = info.file.response.data.id;
            uploadedFileIds.value = uploadedFileIds.value.filter(id => id !== fileId);
        }
    }
};
// 上传文件的处理函数
const handleUpload = async (file) => {
    try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await uploadService.postUpload(formData);
        return response;
    }
    catch (error) {
        return false;
    }
};
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
            default: () => { }
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
            }
            else {
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
const items = computed(() => {
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
            };
        }
        return {
            key: id,
            loading: false,
            role: 'local',
            content: message,
        };
    });
});
// ==================== Mounting ====================
onMounted(() => {
    // 显示默认欢迎消息 
    setTimeout(() => {
        // 添加一条AI欢迎消息
        const welcomeMessage = {
            id: 'welcome-message',
            message: '请问有什么可以帮到您？',
            status: 'success' // 成功状态对应AI消息
        };
        setMessages([welcomeMessage]);
    }, 500); // 稍微延迟显示，让界面先加载完成
}); /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_fnComponent = (await import('vue')).defineComponent({});
;
let __VLS_functionalComponentProps;
function __VLS_template() {
    const __VLS_ctx = {};
    const __VLS_localComponents = {
        ...{},
        ...{},
        ...__VLS_ctx,
    };
    let __VLS_components;
    const __VLS_localDirectives = {
        ...{},
        ...__VLS_ctx,
    };
    let __VLS_directives;
    let __VLS_styleScopedClasses;
    // CSS variable injection 
    // CSS variable injection end 
    let __VLS_resolvedLocalAndGlobalComponents;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: ((__VLS_ctx.styles.layout)) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: ((__VLS_ctx.styles.menu)) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: ((__VLS_ctx.styles.logo)) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.img, __VLS_intrinsicElements.img)({ src: ("https://mdn.alipayobjects.com/huamei_iwk9zp/afts/img/A*eco6RrQhxbMAAAAAAAAAAAAADgCCAQ/original"), draggable: ("false"), alt: ("logo"), ...{ style: ((__VLS_ctx.styles['logo-img'])) }, });
    __VLS_elementAsFunction(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({ ...{ style: ((__VLS_ctx.styles['logo-span'])) }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.Button;
    /** @type { [typeof __VLS_components.Button, typeof __VLS_components.Button, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ ...{ 'onClick': {} }, type: ("link"), ...{ style: ((__VLS_ctx.styles.addBtn)) }, }));
    const __VLS_2 = __VLS_1({ ...{ 'onClick': {} }, type: ("link"), ...{ style: ((__VLS_ctx.styles.addBtn)) }, }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_6;
    const __VLS_7 = {
        onClick: (__VLS_ctx.onAddConversation)
    };
    let __VLS_3;
    let __VLS_4;
    const __VLS_8 = __VLS_resolvedLocalAndGlobalComponents.PlusOutlined;
    /** @type { [typeof __VLS_components.PlusOutlined, ] } */
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent(__VLS_8, new __VLS_8({}));
    const __VLS_10 = __VLS_9({}, ...__VLS_functionalComponentArgsRest(__VLS_9));
    __VLS_nonNullable(__VLS_5.slots).default;
    var __VLS_5;
    const __VLS_14 = __VLS_resolvedLocalAndGlobalComponents.Conversations;
    /** @type { [typeof __VLS_components.Conversations, ] } */
    // @ts-ignore
    const __VLS_15 = __VLS_asFunctionalComponent(__VLS_14, new __VLS_14({ ...{ 'onActiveChange': {} }, items: ((__VLS_ctx.conversationsItems)), ...{ style: ((__VLS_ctx.styles.conversations)) }, activeKey: ((__VLS_ctx.activeKey)), }));
    const __VLS_16 = __VLS_15({ ...{ 'onActiveChange': {} }, items: ((__VLS_ctx.conversationsItems)), ...{ style: ((__VLS_ctx.styles.conversations)) }, activeKey: ((__VLS_ctx.activeKey)), }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    let __VLS_20;
    const __VLS_21 = {
        onActiveChange: (__VLS_ctx.onConversationClick)
    };
    let __VLS_17;
    let __VLS_18;
    var __VLS_19;
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ style: ((__VLS_ctx.styles.chat)) }, });
    const __VLS_22 = ((__VLS_ctx.Bubble.List));
    // @ts-ignore
    const __VLS_23 = __VLS_asFunctionalComponent(__VLS_22, new __VLS_22({ items: ((__VLS_ctx.items)), roles: ((__VLS_ctx.roles)), ...{ style: ((__VLS_ctx.styles.messages)) }, }));
    const __VLS_24 = __VLS_23({ items: ((__VLS_ctx.items)), roles: ((__VLS_ctx.roles)), ...{ style: ((__VLS_ctx.styles.messages)) }, }, ...__VLS_functionalComponentArgsRest(__VLS_23));
    const __VLS_28 = __VLS_resolvedLocalAndGlobalComponents.Sender;
    /** @type { [typeof __VLS_components.Sender, typeof __VLS_components.Sender, ] } */
    // @ts-ignore
    const __VLS_29 = __VLS_asFunctionalComponent(__VLS_28, new __VLS_28({ ...{ 'onSubmit': {} }, ...{ 'onChange': {} }, ...{ 'onCancel': {} }, value: ((__VLS_ctx.content)), ...{ style: ((__VLS_ctx.styles.sender)) }, loading: ((__VLS_ctx.agentRequestLoading)), }));
    const __VLS_30 = __VLS_29({ ...{ 'onSubmit': {} }, ...{ 'onChange': {} }, ...{ 'onCancel': {} }, value: ((__VLS_ctx.content)), ...{ style: ((__VLS_ctx.styles.sender)) }, loading: ((__VLS_ctx.agentRequestLoading)), }, ...__VLS_functionalComponentArgsRest(__VLS_29));
    let __VLS_34;
    const __VLS_35 = {
        onSubmit: (__VLS_ctx.onSubmit)
    };
    const __VLS_36 = {
        onChange: (value => __VLS_ctx.content = value)
    };
    const __VLS_37 = {
        onCancel: (__VLS_ctx.onCancel)
    };
    let __VLS_31;
    let __VLS_32;
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { prefix: __VLS_thisSlot } = __VLS_nonNullable(__VLS_33.slots);
        const __VLS_38 = __VLS_resolvedLocalAndGlobalComponents.Badge;
        /** @type { [typeof __VLS_components.Badge, typeof __VLS_components.Badge, ] } */
        // @ts-ignore
        const __VLS_39 = __VLS_asFunctionalComponent(__VLS_38, new __VLS_38({ dot: ((__VLS_ctx.attachedFiles.length > 0 && !__VLS_ctx.headerOpen)), }));
        const __VLS_40 = __VLS_39({ dot: ((__VLS_ctx.attachedFiles.length > 0 && !__VLS_ctx.headerOpen)), }, ...__VLS_functionalComponentArgsRest(__VLS_39));
        const __VLS_44 = __VLS_resolvedLocalAndGlobalComponents.Button;
        /** @type { [typeof __VLS_components.Button, typeof __VLS_components.Button, ] } */
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent(__VLS_44, new __VLS_44({ ...{ 'onClick': {} }, type: ("text"), }));
        const __VLS_46 = __VLS_45({ ...{ 'onClick': {} }, type: ("text"), }, ...__VLS_functionalComponentArgsRest(__VLS_45));
        let __VLS_50;
        const __VLS_51 = {
            onClick: (() => __VLS_ctx.headerOpen = !__VLS_ctx.headerOpen)
        };
        let __VLS_47;
        let __VLS_48;
        __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
        {
            const { icon: __VLS_thisSlot } = __VLS_nonNullable(__VLS_49.slots);
            const __VLS_52 = __VLS_resolvedLocalAndGlobalComponents.PaperClipOutlined;
            /** @type { [typeof __VLS_components.PaperClipOutlined, ] } */
            // @ts-ignore
            const __VLS_53 = __VLS_asFunctionalComponent(__VLS_52, new __VLS_52({}));
            const __VLS_54 = __VLS_53({}, ...__VLS_functionalComponentArgsRest(__VLS_53));
        }
        var __VLS_49;
        __VLS_nonNullable(__VLS_43.slots).default;
        var __VLS_43;
    }
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { header: __VLS_thisSlot } = __VLS_nonNullable(__VLS_33.slots);
        const __VLS_58 = ((__VLS_ctx.Sender.Header), (__VLS_ctx.Sender.Header));
        // @ts-ignore
        const __VLS_59 = __VLS_asFunctionalComponent(__VLS_58, new __VLS_58({ ...{ 'onOpenChange': {} }, title: ("Attachments"), open: ((__VLS_ctx.headerOpen)), styles: (({ content: { padding: 0 } })), }));
        const __VLS_60 = __VLS_59({ ...{ 'onOpenChange': {} }, title: ("Attachments"), open: ((__VLS_ctx.headerOpen)), styles: (({ content: { padding: 0 } })), }, ...__VLS_functionalComponentArgsRest(__VLS_59));
        let __VLS_64;
        const __VLS_65 = {
            onOpenChange: (open => __VLS_ctx.headerOpen = open)
        };
        let __VLS_61;
        let __VLS_62;
        const __VLS_66 = __VLS_resolvedLocalAndGlobalComponents.Attachments;
        /** @type { [typeof __VLS_components.Attachments, typeof __VLS_components.Attachments, ] } */
        // @ts-ignore
        const __VLS_67 = __VLS_asFunctionalComponent(__VLS_66, new __VLS_66({ ...{ 'onChange': {} }, beforeUpload: ((() => true)), customRequest: ((({ file, onSuccess, onError }) => {
                __VLS_ctx.handleUpload(file)
                    .then(res => {
                    onSuccess(res);
                })
                    .catch(err => {
                    onError(err);
                });
            })), items: ((__VLS_ctx.attachedFiles)), }));
        const __VLS_68 = __VLS_67({ ...{ 'onChange': {} }, beforeUpload: ((() => true)), customRequest: ((({ file, onSuccess, onError }) => {
                __VLS_ctx.handleUpload(file)
                    .then(res => {
                    onSuccess(res);
                })
                    .catch(err => {
                    onError(err);
                });
            })), items: ((__VLS_ctx.attachedFiles)), }, ...__VLS_functionalComponentArgsRest(__VLS_67));
        let __VLS_72;
        const __VLS_73 = {
            onChange: (__VLS_ctx.handleFileChange)
        };
        let __VLS_69;
        let __VLS_70;
        __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
        {
            const { placeholder: __VLS_thisSlot } = __VLS_nonNullable(__VLS_71.slots);
            const [type] = __VLS_getSlotParams(__VLS_thisSlot);
            if (type && type.type === 'inline') {
                const __VLS_74 = __VLS_resolvedLocalAndGlobalComponents.Flex;
                /** @type { [typeof __VLS_components.Flex, typeof __VLS_components.Flex, ] } */
                // @ts-ignore
                const __VLS_75 = __VLS_asFunctionalComponent(__VLS_74, new __VLS_74({ align: ("center"), justify: ("center"), vertical: (true), gap: ("2"), }));
                const __VLS_76 = __VLS_75({ align: ("center"), justify: ("center"), vertical: (true), gap: ("2"), }, ...__VLS_functionalComponentArgsRest(__VLS_75));
                const __VLS_80 = ((__VLS_ctx.Typography.Text), (__VLS_ctx.Typography.Text));
                // @ts-ignore
                const __VLS_81 = __VLS_asFunctionalComponent(__VLS_80, new __VLS_80({ ...{ style: ({}) }, }));
                const __VLS_82 = __VLS_81({ ...{ style: ({}) }, }, ...__VLS_functionalComponentArgsRest(__VLS_81));
                const __VLS_86 = __VLS_resolvedLocalAndGlobalComponents.CloudUploadOutlined;
                /** @type { [typeof __VLS_components.CloudUploadOutlined, ] } */
                // @ts-ignore
                const __VLS_87 = __VLS_asFunctionalComponent(__VLS_86, new __VLS_86({}));
                const __VLS_88 = __VLS_87({}, ...__VLS_functionalComponentArgsRest(__VLS_87));
                __VLS_nonNullable(__VLS_85.slots).default;
                var __VLS_85;
                const __VLS_92 = ((__VLS_ctx.Typography.Title), (__VLS_ctx.Typography.Title));
                // @ts-ignore
                const __VLS_93 = __VLS_asFunctionalComponent(__VLS_92, new __VLS_92({ level: ((5)), ...{ style: ({}) }, }));
                const __VLS_94 = __VLS_93({ level: ((5)), ...{ style: ({}) }, }, ...__VLS_functionalComponentArgsRest(__VLS_93));
                __VLS_nonNullable(__VLS_97.slots).default;
                var __VLS_97;
                const __VLS_98 = ((__VLS_ctx.Typography.Text), (__VLS_ctx.Typography.Text));
                // @ts-ignore
                const __VLS_99 = __VLS_asFunctionalComponent(__VLS_98, new __VLS_98({ type: ("secondary"), }));
                const __VLS_100 = __VLS_99({ type: ("secondary"), }, ...__VLS_functionalComponentArgsRest(__VLS_99));
                __VLS_nonNullable(__VLS_103.slots).default;
                var __VLS_103;
                __VLS_nonNullable(__VLS_79.slots).default;
                var __VLS_79;
            }
            if (type && type.type === 'drop') {
                const __VLS_104 = ((__VLS_ctx.Typography.Text), (__VLS_ctx.Typography.Text));
                // @ts-ignore
                const __VLS_105 = __VLS_asFunctionalComponent(__VLS_104, new __VLS_104({}));
                const __VLS_106 = __VLS_105({}, ...__VLS_functionalComponentArgsRest(__VLS_105));
                __VLS_nonNullable(__VLS_109.slots).default;
                var __VLS_109;
            }
        }
        var __VLS_71;
        __VLS_nonNullable(__VLS_63.slots).default;
        var __VLS_63;
    }
    var __VLS_33;
    var __VLS_slots;
    var __VLS_inheritedAttrs;
    const __VLS_refs = {};
    var $refs;
    var $el;
    return {
        attrs: {},
        slots: __VLS_slots,
        refs: $refs,
        rootEl: $el,
    };
}
;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            CloudUploadOutlined: CloudUploadOutlined,
            PaperClipOutlined: PaperClipOutlined,
            PlusOutlined: PlusOutlined,
            Badge: Badge,
            Button: Button,
            Flex: Flex,
            Typography: Typography,
            Attachments: Attachments,
            Bubble: Bubble,
            Conversations: Conversations,
            Sender: Sender,
            styles: styles,
            roles: roles,
            headerOpen: headerOpen,
            content: content,
            conversationsItems: conversationsItems,
            activeKey: activeKey,
            attachedFiles: attachedFiles,
            agentRequestLoading: agentRequestLoading,
            onSubmit: onSubmit,
            onCancel: onCancel,
            onAddConversation: onAddConversation,
            onConversationClick: onConversationClick,
            handleFileChange: handleFileChange,
            handleUpload: handleUpload,
            items: items,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEl: {},
});
; /* PartiallyEnd: #4569/main.vue */
