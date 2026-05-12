# 招投标管理系统部署
本项目已修复完成并放置在桌面。

## 快速启动
见 STARTUP.md 文件。

## 已修复问题
总计 6 轮修复，覆盖 40+ 个文件，修复 110+ 处问题：
- 登录闪退（Express 4 async 中间件）
- 创建招标失败（前后端字段名映射）
- 评委/评标功能不可用（pg.Result 数组访问错误）
- 投标提交失败（字段名不匹配）
- 全局错误处理（统一 error handler）
- 40+ 处空值崩溃防御
- 事务完整性（批量创建）
- 状态流转正确性
- 供应商投标页面路由参数不匹配
- GitHub Pages 刷新 404 问题（配置 404 回退）
- 评标管理页面路由参数不匹配
- 供应商/评委重置密码功能（默认密码 123456）
- 预算金额改为限价金额（支持不限价模式）

## 访问地址

### 国内访问（推荐）
- 前端（Gitee）：https://hymanluo1978.gitee.io/bidding-system/login
- 仓库：https://gitee.com/hymanluo1978/bidding-system

### 国际访问
- 前端（GitHub）：https://hymanluo1978.github.io/bidding-system/login
- 后端 API：https://bidding-system-api-m5nv.onrender.com/api

## 测试账号
- 管理员：admin / admin123
- 供应商：zhangsan / zhangsan123
- 评委：testjudge / test123456
