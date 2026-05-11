# 🚀 招投标管理系统 — 快速启动指南

项目位置：`/Users/mac/Desktop/bidding-system-main/`

## 前提条件

本项目需要 PostgreSQL 16+ 数据库。Homebrew 正在后台安装中。
完成后执行以下步骤：

---

## 1️⃣ 启动 PostgreSQL

```bash
# 初始化数据库（仅首次）
initdb -D /opt/homebrew/var/postgresql@16

# 启动服务
brew services start postgresql@16

# 创建项目数据库
createdb bidding
```

## 2️⃣ 初始化数据

```bash
cd /Users/mac/Desktop/bidding-system-main/server

# 运行种子数据（创建管理员 admin/admin123）
npm run seed
```

## 3️⃣ 启动后端

```bash
cd /Users/mac/Desktop/bidding-system-main/server
npm run dev
# 看到 "招投标系统后端服务已启动" 即成功
```

## 4️⃣ 启动前端（新开终端）

```bash
cd /Users/mac/Desktop/bidding-system-main/client
npm run dev
# 浏览器打开 http://localhost:5173/login
```

## 5️⃣ 登录

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | admin123 |

登录后先走一遍核心流程：
- 工作台 → 查看统计数据
- 招标管理 → 新建招标
- 供应商管理 → 新建供应商账号
- 评委管理 → 新建评委账号
- 用供应商账号登录 → 投标
- 用评委账号登录 → 评标打分
- 管理员确认评标结果

---

## 环境变量

已在 `server/.env` 中配置默认值：
- `DATABASE_URL=postgresql://localhost:5432/bidding`
- `JWT_SECRET=your_secret_here`
- `PORT=3001`

## 项目结构

```
bidding-system-main/
├── client/          # React + Vite + Ant Design 前端
│   └── src/pages/   # 页面组件（admin/supplier/judge/auth）
├── server/          # Node.js + Express + PostgreSQL 后端
│   └── src/
│       ├── routes/      # 6个路由文件
│       ├── models/      # 4个数据模型
│       ├── middleware/  # 认证/文件上传/日志/错误处理
│       └── config/      # 数据库连接 + 种子数据
└── render.yaml      # Render 云部署配置
```

## 部署到 Render

`render.yaml` 已配置好，推送到 GitHub 后在 Render 上连接即可自动部署。
