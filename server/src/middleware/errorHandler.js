/**
 * 全局错误处理中间件
 * 统一错误返回格式，防止敏感信息泄露
 */

const logger = require('../utils/logger');

// 错误码映射
const ERROR_CODES = {
  '23505': { status: 409, message: '数据已存在', code: 'DUPLICATE_ENTRY' },
  '23503': { status: 400, message: '关联数据不存在', code: 'FOREIGN_KEY_VIOLATION' },
  '23502': { status: 400, message: '必填字段不能为空', code: 'NOT_NULL_VIOLATION' },
  '22P02': { status: 400, message: '数据格式错误', code: 'INVALID_TEXT_REPRESENTATION' },
  '42703': { status: 400, message: '字段不存在', code: 'UNDEFINED_COLUMN' },
  '22001': { status: 400, message: '数据超长', code: 'STRING_DATA_RIGHT_TRUNCATION' },
  
  'JsonWebTokenError': { status: 401, message: '无效的令牌', code: 'INVALID_TOKEN' },
  'TokenExpiredError': { status: 401, message: '令牌已过期', code: 'TOKEN_EXPIRED' },
  'NotBeforeError': { status: 401, message: '令牌尚未生效', code: 'TOKEN_NOT_ACTIVE' },
  
  'MulterError': { status: 400, message: '文件上传错误', code: 'UPLOAD_ERROR' },
  
  'DEFAULT': { status: 500, message: '服务器内部错误', code: 'INTERNAL_ERROR' }
};

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id,
    code: err.code
  });

  if (err.code && ERROR_CODES[err.code]) {
    const errorInfo = ERROR_CODES[err.code];
    return res.status(errorInfo.status).json({
      code: errorInfo.status,
      message: errorInfo.message,
      errorCode: errorInfo.code
    });
  }

  if (err.name && ERROR_CODES[err.name]) {
    const errorInfo = ERROR_CODES[err.name];
    return res.status(errorInfo.status).json({
      code: errorInfo.status,
      message: errorInfo.message,
      errorCode: errorInfo.code
    });
  }

  if (err.name === 'MulterError') {
    let message = '文件上传错误';
    if (err.code === 'LIMIT_FILE_SIZE') message = '文件大小超过限制';
    if (err.code === 'LIMIT_FILE_COUNT') message = '文件数量超过限制';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') message = '意外的文件字段';
    return res.status(400).json({
      code: 400,
      message,
      errorCode: 'UPLOAD_ERROR'
    });
  }

  if (err.statusCode) {
    return res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      errorCode: err.errorCode || 'BUSINESS_ERROR'
    });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      code: 400,
      message: '请求体JSON格式错误',
      errorCode: 'INVALID_JSON'
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      code: 413,
      message: '请求数据过大',
      errorCode: 'PAYLOAD_TOO_LARGE'
    });
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const defaultError = ERROR_CODES['DEFAULT'];
  
  res.status(defaultError.status).json({
    code: defaultError.status,
    message: isProduction ? defaultError.message : err.message,
    errorCode: defaultError.code,
    ...(isProduction ? {} : { stack: err.stack })
  });
}

/**
 * 404 错误处理
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    code: 404,
    message: '请求的资源不存在',
    errorCode: 'NOT_FOUND'
  });
}

/**
 * 异步错误包装器
 * 自动捕获 async 函数中的错误
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 业务错误类
 */
class BusinessError extends Error {
  constructor(message, statusCode = 400, errorCode = 'BUSINESS_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  BusinessError
};
