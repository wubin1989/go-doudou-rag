import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
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
  history: createWebHistory(),
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