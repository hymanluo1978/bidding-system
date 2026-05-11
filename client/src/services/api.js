import axios from 'axios';

// 后端地址：开发环境也直接用 Render，省去本地 PostgreSQL
const baseURL = 'https://bidding-system-api-m5nv.onrender.com/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 自动附加 JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理 401 未授权
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // 清除本地存储的认证信息
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // 跳转到登录页（动态前缀）
      const basePath = window.location.pathname.split('/').slice(0, 2).join('/') || '';
      window.location.href = basePath + '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
