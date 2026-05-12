/**
 * 数据库初始化种子数据
 * PostgreSQL 版本
 */

const bcrypt = require('bcryptjs');
const { query } = require('./database');

async function initSeedData() {
  try {
    // 检查是否已有管理员
    const adminResult = await query("SELECT id FROM users WHERE username = 'admin'");
    
    if (adminResult.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await query(`
        INSERT INTO users (username, password, real_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, ['admin', hashedPassword, '系统管理员', 'admin', 1]);
      
      console.log('默认管理员账号已创建: admin / admin123');
    }
    
    // 检查是否已有一级管理员
    const managerResult = await query("SELECT id FROM users WHERE username = 'manager'");
    
    if (managerResult.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('manager123', 10);
      
      await query(`
        INSERT INTO users (username, password, real_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
      `, ['manager', hashedPassword, '一般管理员', 'manager', 1]);
      
      console.log('默认一般管理员账号已创建: manager / manager123');
    }
  } catch (err) {
    console.error('种子数据初始化失败:', err.message);
  }
}

module.exports = { initSeedData };
