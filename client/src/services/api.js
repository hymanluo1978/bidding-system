import axios from 'axios';

// 根据环境判断使用哪个后端地址
const isProduction = import.meta.env.PROD;
const baseURL = isProduction 
  ? 'https://bidding-system-api-m5nv.onrender.com/api'  // Render 后端地址
  : '/api';  // 开发环境使用本地代理

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
