<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Form, Input, Button, Card, message, Typography } from 'ant-design-vue';
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue';
import { useRouter } from 'vue-router';
import { loginService } from '@/api_auth/LoginService';
import { TokenService } from '@/httputil/TokenService';

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
    } catch (error: any) {
      message.error(error.message || '登录失败，请检查用户名和密码');
    } finally {
      loading.value = false;
    }
  } catch (error) {
    message.error('表单验证失败，请检查输入');
  }
};
</script>

<template>
  <div class="login-container">
    <Card class="login-card">
      <Typography.Title :level="3" style="text-align: center; margin-bottom: 24px">
        系统登录
      </Typography.Title>
      
      <Form 
        ref="formRef"
        :model="formState" 
        layout="vertical"
        @finish="handleLogin"
      >
        <Form.Item name="username">
          <Input 
            v-model:value="formState.username" 
            size="large"
            placeholder="请输入用户名"
          >
            <template #prefix>
              <UserOutlined />
            </template>
          </Input>
        </Form.Item>
        
        <Form.Item name="password">
          <Input.Password 
            v-model:value="formState.password" 
            size="large"
            placeholder="请输入密码"
          >
            <template #prefix>
              <LockOutlined />
            </template>
          </Input.Password>
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="primary" 
            html-type="submit" 
            size="large" 
            :loading="loading"
            block
          >
            登录
          </Button>
        </Form.Item>
      </Form>
    </Card>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f0f2f5;
}

.login-card {
  width: 400px;
  padding: 20px 10px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}
</style> 