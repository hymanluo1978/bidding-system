const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

function logOperation(action, targetType, targetId) {
  return (req, res, next) => {
    // 在响应完成后记录日志
    const originalEnd = res.end;
    res.end = async function(...args) {
      try {
        await query(
          `INSERT INTO operation_logs (id, user_id, action, target_type, target_id, detail, ip, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
          [
            uuidv4(),
            req.user ? req.user.id : null,
            action,
            targetType || '',
            targetId || '',
            JSON.stringify({ method: req.method, url: req.originalUrl }).substring(0, 500),
            req.ip || req.connection.remoteAddress
          ]
        );
      } catch (err) {
        console.error('日志记录失败:', err.message);
      }
      originalEnd.apply(res, args);
    };
    next();
  };
}

module.exports = { logOperation };
