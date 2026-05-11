const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// 使用绝对路径，与 app.js 保持一致
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, '..', '..', 'uploads');

// 确保上传目录存在
const uploadDirs = {
  tenders: path.join(UPLOAD_DIR, 'tenders'),
  bids: path.join(UPLOAD_DIR, 'bids'),
  avatars: path.join(UPLOAD_DIR, 'avatars'),
  general: path.join(UPLOAD_DIR, 'general')
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 存储配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 从请求路径中推断上传分类
    const urlPath = req.originalUrl || '';
    let category = 'general';
    if (urlPath.includes('/tenders/')) category = 'tenders';
    else if (urlPath.includes('/bids')) category = 'bids';
    else if (urlPath.includes('/avatar')) category = 'avatars';

    const dir = uploadDirs[category] || uploadDirs.general;
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/x-zip-compressed'
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`不支持的文件类型: ${file.mimetype}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

module.exports = upload;
