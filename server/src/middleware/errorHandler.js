/**
 * 全局错误处理中间件
 * 统一错误返回格式，防止敏感信息泄露
 */

const logger = require('../utils/logger');

// 错误码映射
const ERROR_CODES = {
  // 数据库错误
  '23505': { status: 409, message: '数据已存在', code: 'DUPLICATE_ENTRY' },
  '23503': { status: 400, message: '关联数据不存在', code: 'FOREIGN_KEY_VIOLATION' },
  '23502': { status: 400, message: '必填字段不能为空', code: 'NOT_NULL_VIOLATION' },
  '22P02': { status: 400, message: '数据格式错误', code: 'INVALID_TEXT_REPRESENTATION' },
  
  // JWT 错误
  'JsonWebTokenError': { status: 401, message: '无效的令牌', code: 'INVALID_TOKEN' },
  'TokenExpiredError': { status: 401, message: '令牌已过期', code: 'TOKEN_EXPIRED' },
  
  // 默认错误
  'DEFAULT': { status: 500, message: '服务器内部错误', code: 'INTERNAL_ERROR' }
};

/**
 * 全局错误处理中间件
 */
function errorHandler(err, req, res, next) {
  // 记录错误日志
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id,
    code: err.code
  });

  // PostgreSQL 错误
  if (err.code && ERROR_CODES[err.code]) {
    const errorInfo = ERROR_CODES[err.code];
    return res.status(errorInfo.status).json({
      code: errorInfo.status,
      message: errorInfo.message,
      errorCode: errorInfo.code
    });
  }

  // JWT 错误
  if (err.name && ERROR_CODES[err.name]) {
    const errorInfo = ERROR_CODES[err.name];
    return res.status(errorInfo.status).json({
      code: errorInfo.status,
      message: errorInfo.message,
      errorCode: errorInfo.code
    });
  }

  // 自定义业务错误
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      code: err.statusCode,
      message: err.message,
      errorCode: err.errorCode || 'BUSINESS_ERROR'
    });
  }

  // 生产环境隐藏详细错误
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
