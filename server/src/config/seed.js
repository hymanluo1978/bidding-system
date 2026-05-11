/**
 * 数据库初始化种子数据
 * PostgreSQL 版本
 */

const bcrypt = require('bcryptjs');
const { query } = require('./database');

async function initSeedData() {
  try {
    // 检查是否已有管理员
    const result = await query("SELECT id FROM users WHERE username = 'admin'");
    
    if (result.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await query(`
        INSERT INTO users (username, password, real_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', hashedPassword, '系统管理员', 'admin', 1]);
      
      console.log('默认管理员账号已创建: admin / admin123');
    }
  } catch (err) {
    console.error('种子数据初始化失败:', err.message);
  }
}

module.exports = { initSeedData };
