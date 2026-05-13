const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');

const app = express();

// ==================== CORS 中间件 ====================
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || '';
const allowedOriginsList = allowedOriginsEnv.split(',').map(s => s.trim()).filter(Boolean);

console.log(`[CORS] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[CORS] ALLOWED_ORIGINS: ${allowedOriginsList.join(', ') || '(未配置)'}`);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    if (allowedOriginsList.length === 0) {
      console.warn(`[CORS] 允许未配置白名单的来源: ${origin}`);
      return callback(null, true);
    }
    if (allowedOriginsList.includes(origin)) return callback(null, true);
    console.warn(`[CORS] 拒绝来源: ${origin}`);
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
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
console.log(`[Static] Upload directory: ${UPLOAD_DIR}`);



// 文件下载路由 - 正确处理二进制文件
app.get('/uploads/*', (req, res, next) => {
  const filePath = req.params[0];
  const fullPath = path.resolve(UPLOAD_DIR, filePath);
  
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ code: 403, message: '禁止访问', errorCode: 'FORBIDDEN' });
  }
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ code: 404, message: '请求的资源不存在', errorCode: 'NOT_FOUND' });
      }
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain; charset=utf-8',
      '.zip': 'application/zip'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileName = encodeURIComponent(path.basename(fullPath));
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', data.length);
    res.send(data);
  });
});

// 备用下载路由
app.get('/api/uploads/*', (req, res, next) => {
  const filePath = req.params[0];
  const fullPath = path.resolve(UPLOAD_DIR, filePath);
  
  if (!fullPath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ code: 403, message: '禁止访问', errorCode: 'FORBIDDEN' });
  }
  
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ code: 404, message: '请求的资源不存在', errorCode: 'NOT_FOUND' });
      }
      return res.status(500).json({ code: 500, message: '服务器内部错误' });
    }
    
    const ext = path.extname(fullPath).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.txt': 'text/plain; charset=utf-8',
      '.zip': 'application/zip'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileName = encodeURIComponent(path.basename(fullPath));
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', data.length);
    res.send(data);
  });
});

// 直接用 express.static，不加前缀
app.use('/uploads', express.static(UPLOAD_DIR, {
  fallthrough: true,
  maxAge: '1d'
}));

// 备用路由：/api/uploads 也映射到同一目录
app.use('/api/uploads', express.static(UPLOAD_DIR, {
  fallthrough: true,
  maxAge: '1d'
}));

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

// 公告通知路由
app.use('/api/announcements', require('./routes/announcements'));

// 操作日志路由
app.use('/api/logs', require('./routes/logs'));

// 用户管理路由
app.use('/api/users', require('./routes/users'));

// ==================== 404 处理 ====================
app.use(notFoundHandler);

// ==================== 全局错误处理 ====================
app.use(errorHandler);

module.exports = app;
