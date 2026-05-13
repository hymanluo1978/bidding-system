# 招投标管理系统

基于 React + Node.js + PostgreSQL 的全栈招投标管理系统，支持完整的招标、投标、评标、中标业务流程。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Ant Design 5 + Vite + React Router 6 |
| 后端 | Node.js + Express 4 + JWT + Multer |
| 数据库 | PostgreSQL 15 (Render) |
| 部署 | GitHub Pages (前端) + Render (后端) |
| CI/CD | GitHub Actions |

## 系统功能

### 招标管理
- 创建、编辑、发布招标项目
- 自定义限价金额（供应商可见）或不限价
- 上传招标文件附件（新建时即可选择附件）
- 查看投标统计
- **招标状态机**：draft → published → bidding → evaluation → completed，强制合法流转

### 投标管理
- 供应商查看已发布招标公告（含已投标的评标中/已完成项目）
- 下载招标文件
- 提交投标（含报价、技术方案、商务方案、附件）
- 撤回投标（截止时间前）

### 评标管理
- 组建评标委员会
- **自定义权重配置**：技术/商务/价格权重可灵活调整
- **加权评分计算**：total_score = (技术分×技术权重 + 商务分×商务权重 + 价格分×价格权重) / 100
- **查看投标附件**：管理员可查看供应商上传的所有附件
- **询标澄清**：管理员可向供应商发起询标，供应商回复澄清
- **评标结果导出**：CSV 格式导出含权重配置的评标结果
- 评分汇总与中标确认

### 公告通知
- 管理员发布、编辑、删除公告
- 公告类型：通知、结果公示、更正、取消
- 供应商可查看公告

### 操作日志
- 自动记录关键操作
- 支持按操作类型、目标类型、时间范围筛选
- 仅管理员可查看

### 账号管理
- **系统管理员（admin）**：系统管理、删除招标项目、用户管理
- **一般管理员（manager）**：招标管理、供应商管理、评委管理、评标管理
- **供应商**：投标参与
- **评委**：评标打分
- **用户管理**：系统管理员可创建、编辑、删除各类用户

### 供应商管理
- 创建、编辑、启用/禁用供应商
- 批量创建（支持 JSON 数组或 CSV 文件上传）
- 导出供应商列表（CSV 格式）

## 安全特性

- JWT 令牌认证 + 后端会话校验
- 路径遍历防护（文件下载路由）
- 字段白名单过滤（防止越权修改）
- 数据库事务保障（级联删除、原子操作）
- 密码不明文返回
- CORS 严格配置
- 全局异常捕获（uncaughtException / unhandledRejection）
- 统一错误返回格式

## 访问地址

### 国内访问（推荐）
- 前端（Gitee）：https://hymanluo1978.gitee.io/bidding-system/login
- 仓库：https://gitee.com/hymanluo1978/bidding-system

### 国际访问
- 前端（GitHub）：https://hymanluo1978.github.io/bidding-system/login
- 后端 API：https://bidding-system-api-m5nv.onrender.com/api

## 测试账号
- 系统管理员：admin / admin123（拥有所有权限，包括删除招标项目）
- 一般管理员：manager / manager123（可管理招标、供应商、评委，无删除权限）
- 供应商：zhangsan / zhangsan123
- 评委：testjudge / test123456

## 业务流程

```
1. 管理员创建招标项目 → 发布
2. 供应商查看招标公告 → 投标（提交报价、方案、附件）
3. 供应商撤回投标（截止前可操作）
4. 管理员组建评标委员会 → 配置权重
5. 评委对投标打分
6. 管理员查看评标结果 → 可发起询标澄清
7. 供应商收到询标 → 回复澄清
8. 管理员确认中标结果
```

## 快速启动

见 [STARTUP.md](./STARTUP.md) 文件。

## 测试

```bash
# 对远程服务运行 API 测试
TEST_URL=https://bidding-system-api-m5nv.onrender.com node --test server/tests/api.test.js

# 对本地服务运行 API 测试
node --test server/tests/api.test.js
```

测试覆盖 11 个模块、25+ 个用例，包括：认证、招标CRUD、状态机、评委管理、供应商管理、权重校验、公告管理、操作日志、权限控制等。

## 后端部署说明
后端部署在 Render 云服务，代码推送到 GitHub 后自动触发部署：
1. 推送代码到 `main` 分支
2. Render 自动检测并部署
3. 数据库表会自动创建/迁移

## 项目结构

```
bidding-system/
├── client/                    # 前端 React 项目
│   ├── src/
│   │   ├── components/        # 公共组件
│   │   ├── layouts/           # 布局组件
│   │   ├── pages/             # 页面组件
│   │   │   ├── admin/         # 管理员页面
│   │   │   ├── auth/          # 认证页面
│   │   │   ├── judge/         # 评委页面
│   │   │   └── supplier/      # 供应商页面
│   │   └── services/          # API 服务
│   └── vite.config.js
├── server/                    # 后端 Node.js 项目
│   ├── src/
│   │   ├── config/            # 数据库配置、种子数据
│   │   ├── middleware/         # 中间件（认证、校验、上传、错误处理）
│   │   ├── models/            # 数据模型
│   │   ├── routes/            # API 路由
│   │   ├── utils/             # 工具函数
│   │   ├── app.js             # Express 应用
│   │   └── server.js          # 服务入口
│   └── tests/                 # API 测试
├── render.yaml                # Render 部署配置
└── .github/workflows/         # GitHub Actions CI/CD
```
