import { reactive, ref } from 'vue';
import { Form, Input, Button, Card, message, Typography } from 'ant-design-vue';
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue';
import { useRouter } from 'vue-router';
import { loginService } from '@/api_auth/LoginService';
import { TokenService } from '@/httputil/TokenService';
const { defineProps, defineSlots, defineEmits, defineExpose, defineModel, defineOptions, withDefaults, } = await import('vue');
const router = useRouter();
const loading = ref(false);
// 表单引用
const formRef = ref();
// 表单状态
const formState = reactive({
    username: '',
    password: '',
});
// 表单校验规则
const rules = {
    username: [
        { required: true, message: '请输入用户名', trigger: 'blur' },
    ],
    password: [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码长度不能少于6个字符', trigger: 'blur' },
    ],
};
// 登录处理
const handleLogin = async () => {
    try {
        await formRef.value.validate();
        loading.value = true;
        try {
            const response = await loginService.postLogin({
                username: formState.username,
                password: formState.password
            });
            // 保存token和过期时间
            TokenService.saveToken(response.data);
            message.success('登录成功');
            // 跳转到主页
            router.push('/demo');
        }
        catch (error) {
            message.error(error.message || '登录失败，请检查用户名和密码');
        }
        finally {
            loading.value = false;
        }
    }
    catch (error) {
        message.error('表单验证失败，请检查输入');
    }
};
; /* PartiallyEnd: #3632/scriptSetup.vue */
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
    __VLS_elementAsFunction(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({ ...{ class: ("login-container") }, });
    const __VLS_0 = __VLS_resolvedLocalAndGlobalComponents.Card;
    /** @type { [typeof __VLS_components.Card, typeof __VLS_components.Card, ] } */
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({ ...{ class: ("login-card") }, }));
    const __VLS_2 = __VLS_1({ ...{ class: ("login-card") }, }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const __VLS_6 = ((__VLS_ctx.Typography.Title), (__VLS_ctx.Typography.Title));
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(__VLS_6, new __VLS_6({ level: ((3)), ...{ style: ({}) }, }));
    const __VLS_8 = __VLS_7({ level: ((3)), ...{ style: ({}) }, }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    __VLS_nonNullable(__VLS_11.slots).default;
    var __VLS_11;
    const __VLS_12 = __VLS_resolvedLocalAndGlobalComponents.Form;
    /** @type { [typeof __VLS_components.Form, typeof __VLS_components.Form, ] } */
    // @ts-ignore
    const __VLS_13 = __VLS_asFunctionalComponent(__VLS_12, new __VLS_12({ ...{ 'onFinish': {} }, ref: ("formRef"), model: ((__VLS_ctx.formState)), layout: ("vertical"), }));
    const __VLS_14 = __VLS_13({ ...{ 'onFinish': {} }, ref: ("formRef"), model: ((__VLS_ctx.formState)), layout: ("vertical"), }, ...__VLS_functionalComponentArgsRest(__VLS_13));
    // @ts-ignore navigation for `const formRef = ref()`
    __VLS_ctx.formRef;
    var __VLS_18 = {};
    let __VLS_19;
    const __VLS_20 = {
        onFinish: (__VLS_ctx.handleLogin)
    };
    let __VLS_15;
    let __VLS_16;
    const __VLS_21 = ((__VLS_ctx.Form.Item), (__VLS_ctx.Form.Item));
    // @ts-ignore
    const __VLS_22 = __VLS_asFunctionalComponent(__VLS_21, new __VLS_21({ name: ("username"), }));
    const __VLS_23 = __VLS_22({ name: ("username"), }, ...__VLS_functionalComponentArgsRest(__VLS_22));
    const __VLS_27 = __VLS_resolvedLocalAndGlobalComponents.Input;
    /** @type { [typeof __VLS_components.Input, typeof __VLS_components.Input, ] } */
    // @ts-ignore
    const __VLS_28 = __VLS_asFunctionalComponent(__VLS_27, new __VLS_27({ value: ((__VLS_ctx.formState.username)), size: ("large"), placeholder: ("请输入用户名"), }));
    const __VLS_29 = __VLS_28({ value: ((__VLS_ctx.formState.username)), size: ("large"), placeholder: ("请输入用户名"), }, ...__VLS_functionalComponentArgsRest(__VLS_28));
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { prefix: __VLS_thisSlot } = __VLS_nonNullable(__VLS_32.slots);
        const __VLS_33 = __VLS_resolvedLocalAndGlobalComponents.UserOutlined;
        /** @type { [typeof __VLS_components.UserOutlined, ] } */
        // @ts-ignore
        const __VLS_34 = __VLS_asFunctionalComponent(__VLS_33, new __VLS_33({}));
        const __VLS_35 = __VLS_34({}, ...__VLS_functionalComponentArgsRest(__VLS_34));
    }
    var __VLS_32;
    __VLS_nonNullable(__VLS_26.slots).default;
    var __VLS_26;
    const __VLS_39 = ((__VLS_ctx.Form.Item), (__VLS_ctx.Form.Item));
    // @ts-ignore
    const __VLS_40 = __VLS_asFunctionalComponent(__VLS_39, new __VLS_39({ name: ("password"), }));
    const __VLS_41 = __VLS_40({ name: ("password"), }, ...__VLS_functionalComponentArgsRest(__VLS_40));
    const __VLS_45 = ((__VLS_ctx.Input.Password), (__VLS_ctx.Input.Password));
    // @ts-ignore
    const __VLS_46 = __VLS_asFunctionalComponent(__VLS_45, new __VLS_45({ value: ((__VLS_ctx.formState.password)), size: ("large"), placeholder: ("请输入密码"), }));
    const __VLS_47 = __VLS_46({ value: ((__VLS_ctx.formState.password)), size: ("large"), placeholder: ("请输入密码"), }, ...__VLS_functionalComponentArgsRest(__VLS_46));
    __VLS_elementAsFunction(__VLS_intrinsicElements.template, __VLS_intrinsicElements.template)({});
    {
        const { prefix: __VLS_thisSlot } = __VLS_nonNullable(__VLS_50.slots);
        const __VLS_51 = __VLS_resolvedLocalAndGlobalComponents.LockOutlined;
        /** @type { [typeof __VLS_components.LockOutlined, ] } */
        // @ts-ignore
        const __VLS_52 = __VLS_asFunctionalComponent(__VLS_51, new __VLS_51({}));
        const __VLS_53 = __VLS_52({}, ...__VLS_functionalComponentArgsRest(__VLS_52));
    }
    var __VLS_50;
    __VLS_nonNullable(__VLS_44.slots).default;
    var __VLS_44;
    const __VLS_57 = ((__VLS_ctx.Form.Item), (__VLS_ctx.Form.Item));
    // @ts-ignore
    const __VLS_58 = __VLS_asFunctionalComponent(__VLS_57, new __VLS_57({}));
    const __VLS_59 = __VLS_58({}, ...__VLS_functionalComponentArgsRest(__VLS_58));
    const __VLS_63 = __VLS_resolvedLocalAndGlobalComponents.Button;
    /** @type { [typeof __VLS_components.Button, typeof __VLS_components.Button, ] } */
    // @ts-ignore
    const __VLS_64 = __VLS_asFunctionalComponent(__VLS_63, new __VLS_63({ type: ("primary"), htmlType: ("submit"), size: ("large"), loading: ((__VLS_ctx.loading)), block: (true), }));
    const __VLS_65 = __VLS_64({ type: ("primary"), htmlType: ("submit"), size: ("large"), loading: ((__VLS_ctx.loading)), block: (true), }, ...__VLS_functionalComponentArgsRest(__VLS_64));
    __VLS_nonNullable(__VLS_68.slots).default;
    var __VLS_68;
    __VLS_nonNullable(__VLS_62.slots).default;
    var __VLS_62;
    __VLS_nonNullable(__VLS_17.slots).default;
    var __VLS_17;
    __VLS_nonNullable(__VLS_5.slots).default;
    var __VLS_5;
    __VLS_styleScopedClasses['login-container'];
    __VLS_styleScopedClasses['login-card'];
    var __VLS_slots;
    var __VLS_inheritedAttrs;
    const __VLS_refs = {
        "formRef": __VLS_18,
    };
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
            Form: Form,
            Input: Input,
            Button: Button,
            Card: Card,
            Typography: Typography,
            UserOutlined: UserOutlined,
            LockOutlined: LockOutlined,
            loading: loading,
            formRef: formRef,
            formState: formState,
            handleLogin: handleLogin,
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
