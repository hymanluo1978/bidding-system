const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { transaction } = require('../utils/transaction');

class User {
  // 创建用户（异步 bcrypt）
  static async create({ username, password, real_name = '', role = 'supplier', phone = '', email = '', company_name = '' }) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await query(`
      INSERT INTO users (username, password, real_name, role, phone, email, company_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, username, real_name, role, phone, email, company_name
    `, [username, hashedPassword, real_name, role, phone, email, company_name]);
    return result.rows[0];
  }

  // 根据用户名查找
  static async findByUsername(username) {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0];
  }

  // 根据ID查找
  static async findById(id) {
    const result = await query(
      'SELECT id, username, real_name, role, phone, email, company_name, status, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // 验证密码（异步）
  static async verifyPassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  // 更新密码（异步）
  static async updatePassword(id, newPassword) {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [hashedPassword, id]);
  }

  // 更新用户信息
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    const allowedFields = ['real_name', 'phone', 'email', 'company_name', 'status'];

    allowedFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        fields.push(`${field} = $${paramIndex}`);
        values.push(data[field]);
        paramIndex++;
      }
    });

    if (fields.length === 0) return false;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
    return true;
  }

  // 分页查询用户列表
  static async findAll({ role, status, keyword, page = 1, pageSize = 20 } = {}) {
    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (role) { where += ` AND role = $${paramIndex}`; params.push(role); paramIndex++; }
    if (status !== undefined && status !== null && status !== '') {
      where += ` AND status = $${paramIndex}`;
      params.push(Number(status));
      paramIndex++;
    }
    if (keyword) {
      where += ` AND (username ILIKE $${paramIndex} OR real_name ILIKE $${paramIndex} OR company_name ILIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }

    const countResult = await query(`SELECT COUNT(*) as count FROM users ${where}`, params);
    const total = parseInt(countResult.rows[0].count, 10) || 0;
    const offset = (page - 1) * pageSize;

    const listResult = await query(`
      SELECT id, username, real_name, role, phone, email, company_name, status, created_at
      FROM users ${where}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, pageSize, offset]);

    return { list: listResult.rows, total, page, pageSize };
  }

  // 删除用户
  static async delete(id) {
    await query('DELETE FROM users WHERE id = $1', [id]);
  }

  // 批量创建供应商（事务包裹）
  static async batchCreate(suppliers) {
    return transaction(async (client) => {
      const results = [];
      for (const item of suppliers) {
        try {
          const hashedPassword = await bcrypt.hash(item.password, 10);
          const result = await client.query(`
            INSERT INTO users (username, password, real_name, role, phone, email, company_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, username, real_name, role, phone, email, company_name
          `, [item.username, hashedPassword, item.real_name || '', 'supplier', item.phone || '', item.email || '', item.company_name || '']);
          results.push({ id: result.rows[0].id, username: result.rows[0].username, real_name: result.rows[0].real_name, success: true });
        } catch (err) {
          results.push({ username: item.username, password: item.password, success: false, error: err?.message || '' });
        }
      }
      return results;
    });
  }
}

module.exports = User;
