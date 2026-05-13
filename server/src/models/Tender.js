const { v4: uuidv4 } = require('uuid');
const { query } = require('../config/database');

class Tender {
  // 创建招标项目
  static async create({ title, project_number, category = '', budget = 0, description = '', requirements = '', qualification_requirements = '', bid_deadline, open_bid_date, creator_id }) {
    const result = await query(`
      INSERT INTO tenders (title, project_number, category, budget, description, requirements, qualification_requirements, bid_deadline, open_bid_date, creator_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, title, project_number, status
    `, [title, project_number, category, budget, description, requirements, qualification_requirements, bid_deadline, open_bid_date, creator_id]);
    return result.rows[0];
  }
  
  // 根据ID查找
  static async findById(id) {
    const result = await query(`
      SELECT t.*, u.real_name as creator_name 
      FROM tenders t 
      LEFT JOIN users u ON t.creator_id = u.id 
      WHERE t.id = $1
    `, [id]);
    return result.rows[0];
  }
  
  // 更新招标项目
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    const allowedFields = ['title', 'project_number', 'category', 'budget', 'description', 'requirements', 'qualification_requirements', 'bid_deadline', 'open_bid_date', 'status', 'publish_date', 'attachments'];
    
    console.log(`[Tender.update] Updating tender ${id} with data:`, JSON.stringify(data));
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        fields.push(`${field} = $${paramIndex}`);
        if (field === 'attachments' && Array.isArray(data[field])) {
          values.push(JSON.stringify(data[field]));
        } else {
          values.push(data[field]);
        }
        paramIndex++;
      }
    });
    
    if (fields.length === 0) {
      console.log(`[Tender.update] No fields to update for tender ${id}`);
      return false;
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const sql = `UPDATE tenders SET ${fields.join(', ')} WHERE id = $${paramIndex}`;
    console.log(`[Tender.update] Executing SQL: ${sql} with params:`, values);
    
    await query(sql, values);
    console.log(`[Tender.update] Tender ${id} updated successfully`);
    return true;
  }
  
  // 分页查询招标列表
  static async findAll({ status, keyword, category, page = 1, pageSize = 20 } = {}) {
    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statuses.length > 0) {
          const placeholders = statuses.map(() => `$${paramIndex++}`).join(',');
          where += ` AND t.status IN (${placeholders})`;
          params.push(...statuses);
        }
      } else {
        where += ` AND t.status = $${paramIndex}`; params.push(status); paramIndex++;
      }
    }
    if (category) { where += ` AND t.category = $${paramIndex}`; params.push(category); paramIndex++; }
    if (keyword) { where += ` AND (t.title ILIKE $${paramIndex} OR t.project_number ILIKE $${paramIndex})`; params.push(`%${keyword}%`); paramIndex++; }
    
    const countResult = await query(`SELECT COUNT(*) as count FROM tenders t ${where}`, params);
    const total = parseInt(countResult.rows[0].count) || 0;
    const offset = (page - 1) * pageSize;
    
    const listResult = await query(`
      SELECT t.*, u.real_name as creator_name,
        (SELECT COUNT(*) FROM bids WHERE tender_id = t.id) as bid_count
      FROM tenders t 
      LEFT JOIN users u ON t.creator_id = u.id 
      ${where} 
      ORDER BY t.created_at DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, pageSize, offset]);
    
    return { list: listResult.rows, total, page, pageSize };
  }
  
  // 获取供应商可见的招标列表
  static async findForSupplier(supplierId, { status, keyword, page = 1, pageSize = 20 } = {}) {
    let where = 'WHERE t.status IN ($1, $2)';
    const params = ['published', 'bidding'];
    let paramIndex = 3;
    
    if (status) { where += ` AND t.status = $${paramIndex}`; params.push(status); paramIndex++; }
    if (keyword) { where += ` AND (t.title ILIKE $${paramIndex} OR t.project_number ILIKE $${paramIndex})`; params.push(`%${keyword}%`); paramIndex++; }
    
    const countResult = await query(`SELECT COUNT(*) as count FROM tenders t ${where}`, params);
    const total = parseInt(countResult.rows[0].count) || 0;
    const offset = (page - 1) * pageSize;
    
    const listResult = await query(`
      SELECT t.*,
        (SELECT COUNT(*) FROM bids WHERE tender_id = t.id AND supplier_id = $${paramIndex}) as has_bid
      FROM tenders t 
      ${where} 
      ORDER BY t.created_at DESC 
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `, [...params, supplierId, pageSize, offset]);
    
    return { list: listResult.rows, total, page, pageSize };
  }
  
  // 删除招标项目
  static async delete(id) {
    await query('DELETE FROM tenders WHERE id = $1', [id]);
  }
}

module.exports = Tender;
