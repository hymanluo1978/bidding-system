import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const getFileUrl = (filePath) => {
  if (!filePath || typeof filePath !== 'string') return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  if (filePath.startsWith('/uploads/')) {
    return apiBase ? `${apiBase}${filePath}` : filePath;
  }
  return filePath;
};

export const safeGet = (obj, path, defaultValue = undefined) => {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const keys = Array.isArray(path) ? path : path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result == null || typeof result !== 'object') return defaultValue;
    result = result[key];
  }
  return result ?? defaultValue;
};

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return Promise.reject(new Error('请求超时，请稍后重试'));
      }
      return Promise.reject(new Error('网络连接异常，请检查网络'));
    }

    const { status, data } = error.response;

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const basename = '/bidding-system';
      window.location.href = basename + '/login';
      return Promise.reject(new Error('登录已过期，请重新登录'));
    }

    if (status === 403) {
      return Promise.reject(new Error(data?.message || '权限不足'));
    }

    if (status === 404) {
      return Promise.reject(new Error(data?.message || '请求的资源不存在'));
    }

    if (status >= 500) {
      return Promise.reject(new Error('服务器异常，请稍后重试'));
    }

    return Promise.reject(error);
  }
);

export default api;
