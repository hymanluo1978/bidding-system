# Docker 部署指南

## 快速启动

### 1. 克隆项目
```bash
git clone https://github.com/hymanluo1978/bidding-system.git
cd bidding-system
```

### 2. 一键启动
```bash
docker-compose up -d
```

### 3. 访问系统
- 前端：http://localhost
- 后端 API：http://localhost:3001/api

### 4. 默认账号
- 系统管理员：admin / admin123
- 一般管理员：manager / manager123

---

## 生产环境部署

### 1. 修改配置

编辑 `docker-compose.yml`，修改以下环境变量：

```yaml
# 后端环境变量
environment:
  JWT_SECRET: 你的JWT密钥（随机字符串）
  ALLOWED_ORIGINS: http://你的域名,http://localhost

# 前端构建参数
args:
  VITE_API_BASE_URL: http://你的域名/api
```

### 2. 启动服务
```bash
docker-compose up -d --build
```

### 3. 配置域名（可选）

如果需要使用域名访问，配置 Nginx 反向代理：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 常用命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 重新构建
docker-compose up -d --build

# 进入后端容器
docker exec -it bidding-api sh

# 进入数据库容器
docker exec -it bidding-db psql -U bidding -d bidding
```

---

## 数据备份

```bash
# 备份数据库
docker exec bidding-db pg_dump -U bidding bidding > backup_$(date +%Y%m%d).sql

# 恢复数据库
cat backup.sql | docker exec -i bidding-db psql -U bidding bidding
```

---

## 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 80 | Web 访问入口 |
| 后端 API | 3001 | API 服务 |
| PostgreSQL | 5432 | 数据库（可选暴露） |

---

## 目录结构

```
bidding-system/
├── docker-compose.yml      # Docker Compose 配置
├── server/
│   ├── Dockerfile          # 后端镜像
│   └── src/                # 后端源码
├── client/
│   ├── Dockerfile          # 前端镜像
│   ├── nginx.conf          # Nginx 配置
│   └── src/                # 前端源码
└── DEPLOY.md               # 本文档
```
