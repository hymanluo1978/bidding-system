/**
 * 数据库事务工具
 * 提供便捷的事务包装函数，确保 ACID 特性
 */

const { pool } = require('../config/database');

/**
 * 在事务中执行回调函数
 * 自动处理 BEGIN / COMMIT / ROLLBACK
 *
 * @param {Function} callback - async (client) => { ...; return result; }
 * @returns {Promise<any>} callback 的返回值
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Express 中间件：为请求附加事务性数据库操作能力
 * 在路由中可通过 req.withTransaction(callback) 使用
 */
function transactionMiddleware(req, res, next) {
  req.transaction = transaction;
  next();
}

module.exports = { transaction, transactionMiddleware };
