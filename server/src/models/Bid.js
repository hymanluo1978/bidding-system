const { query } = require('../config/database');

class Bid {
  // 提交投标
  static async create({ tender_id, supplier_id, bid_price, technical_proposal = '', business_proposal = '', attachments = [] }) {
    const result = await query(`
      INSERT INTO bids (tender_id, supplier_id, bid_price, technical_proposal, business_proposal, attachments)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, tender_id, supplier_id, bid_price, status, created_at
    `, [tender_id, supplier_id, bid_price, technical_proposal, business_proposal, JSON.stringify(attachments)]);
    return result.rows[0];
  }

  // 更新投标
  static async update(id, data) {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    const allowedFields = ['bid_price', 'technical_proposal', 'business_proposal', 'attachments', 'status'];

    allowedFields.forEach(field => {
      if (data[field] !== undefined && data[field] !== null) {
        const val = field === 'attachments' ? JSON.stringify(data[field]) : data[field];
        fields.push(`${field} = $${paramIndex}`);
        values.push(val);
        paramIndex++;
      }
    });

    if (fields.length === 0) return false;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await query(`UPDATE bids SET ${fields.join(', ')} WHERE id = $${paramIndex}`, values);
    return true;
  }

  // 获取招标项目的所有投标（评标时使用）
  static async findByTenderId(tenderId) {
    const result = await query(`
      SELECT b.*, u.username, u.real_name, u.company_name
      FROM bids b
      LEFT JOIN users u ON b.supplier_id = u.id
      WHERE b.tender_id = $1 AND b.status != 'withdrawn'
      ORDER BY b.bid_price ASC
    `, [tenderId]);
    return result.rows;
  }

  // 获取供应商在某个招标项目的投标
  static async findByTenderAndSupplier(tenderId, supplierId) {
    const result = await query('SELECT * FROM bids WHERE tender_id = $1 AND supplier_id = $2', [tenderId, supplierId]);
    return result.rows[0];
  }

  // 获取供应商的所有投标
  static async findBySupplier(supplierId) {
    const result = await query(`
      SELECT b.*, t.title as tender_title, t.project_number, t.status as tender_status, t.bid_deadline
      FROM bids b
      LEFT JOIN tenders t ON b.tender_id = t.id
      WHERE b.supplier_id = $1
      ORDER BY b.created_at DESC
    `, [supplierId]);
    return result.rows;
  }

  // 汇总投标报价
  static async getPriceSummary(tenderId) {
    const result = await query(`
      SELECT b.bid_price, u.company_name, u.real_name
      FROM bids b
      LEFT JOIN users u ON b.supplier_id = u.id
      WHERE b.tender_id = $1 AND b.status = 'submitted'
      ORDER BY b.bid_price ASC
    `, [tenderId]);

    const bids = result.rows;
    const prices = bids.map(b => parseFloat(b.bid_price) || 0);
    return {
      bids,
      total: bids.length,
      min_price: prices.length ? Math.min(...prices) : 0,
      max_price: prices.length ? Math.max(...prices) : 0,
      avg_price: prices.length ? parseFloat((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)) : 0
    };
  }
}

module.exports = Bid;
