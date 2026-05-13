# 招投标系统前端 - 生产环境镜像
FROM node:18-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
RUN npm ci

# 复制源码
COPY . .

# 构建参数：API 后端地址
ARG VITE_API_BASE_URL=http://localhost:3001/api

# 构建
ENV VITE_BUILD_TARGET=vercel
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build:vercel

# 使用 nginx 服务静态文件
FROM nginx:alpine

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
