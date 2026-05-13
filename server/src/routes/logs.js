const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);
router.use(requireRole('admin', 'manager'));

router.get('/', async (req, res, next) => {
  try {
    const { user_id, action, target_type, start_date, end_date, page = 1, pageSize = 20 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (user_id) { where += ` AND l.user_id = $${paramIndex++}`; params.push(user_id); }
    if (action) { where += ` AND l.action ILIKE $${paramIndex++}`; params.push(`%${action}%`); }
    if (target_type) { where += ` AND l.target_type = $${paramIndex++}`; params.push(target_type); }
    if (start_date) { where += ` AND l.created_at >= $${paramIndex++}`; params.push(start_date); }
    if (end_date) { where += ` AND l.created_at <= $${paramIndex++}`; params.push(end_date); }

    const countResult = await query(`SELECT COUNT(*) as count FROM operation_logs l ${where}`, params);
    const total = parseInt(countResult.rows[0].count) || 0;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const listResult = await query(`
      SELECT l.*, u.username, u.real_name
      FROM operation_logs l
      LEFT JOIN users u ON l.user_id = u.id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, parseInt(pageSize), offset]);

    res.json({ code: 200, data: { list: listResult.rows, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
