const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

function logOperation(action, targetType = '', targetId = '', detail = '') {
  return async (req, res, next) => {
    const originalEnd = res.end;
    res.end = function (...args) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        query(`
          INSERT INTO operation_logs (id, user_id, action, target_type, target_id, detail, ip)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          req.user.id,
          action,
          targetType,
          targetId || req.params?.id || '',
          typeof detail === 'function' ? detail(req) : detail,
          req.ip || req.connection?.remoteAddress || ''
        ]).catch(err => console.error('操作日志记录失败:', err.message));
      }
      originalEnd.apply(res, args);
    };
    next();
  };
}

module.exports = { logOperation };
