import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

export const getFileUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/uploads/')) {
    return `${baseURL}${path}`;
  }
  return `${baseURL}/${path}`;
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
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const basePath = window.location.pathname.split('/').slice(0, 2).join('/') || '';
      window.location.href = basePath + '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
