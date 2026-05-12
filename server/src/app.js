const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');

const app = express();

// ==================== CORS 中间件 ====================
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  : '*';

// 如果生产环境未配置允许域名，默认放行（开发阶段安全）
if (Array.isArray(allowedOrigins) && allowedOrigins.length === 0) {
  allowedOrigins.push('*');
}

app.use(cors({
  origin: (origin, callback) => {
    if (allowedOrigins.includes('*') || !origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS 不允许的来源'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 解析 JSON 请求体
app.use(express.json({ limit: '10mb' }));

// 解析 URL 编码请求体
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务 - 统一 uploads 路径
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads');
if (typeof UPLOAD_DIR === 'string') {
  try { require('fs').mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { /* ignore */ }
}
app.use('/uploads', express.static(UPLOAD_DIR));

// 请求日志中间件（简易版）
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
  });
  next();
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    code: 200,
    message: '招投标系统服务运行中',
    timestamp: new Date().toISOString()
  });
});

// 认证路由
app.use('/api/auth', require('./routes/auth'));

// 招标项目路由
app.use('/api/tenders', require('./routes/tenders'));

// 投标路由
app.use('/api/bids', require('./routes/bids'));

// 供应商路由
app.use('/api/suppliers', require('./routes/suppliers'));

// 评委路由
app.use('/api/judges', require('./routes/judges'));

// 评标路由
app.use('/api/evaluation', require('./routes/evaluation'));

// 评标权重配置路由
app.use('/api/weights', require('./routes/weights'));

// 询标澄清路由
app.use('/api/clarifications', require('./routes/clarifications'));

// ==================== 404 处理 ====================
app.use(notFoundHandler);

// ==================== 全局错误处理 ====================
app.use(errorHandler);

module.exports = app;
