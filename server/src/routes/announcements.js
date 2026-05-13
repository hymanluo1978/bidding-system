const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use((req, res, next) => {
  authenticate(req, res, next).catch(next);
});

router.get('/', async (req, res, next) => {
  try {
    const { type, page = 1, pageSize = 20 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (type) {
      where += ` AND a.type = $${paramIndex++}`;
      params.push(type);
    }

    if (req.user.role === 'supplier') {
      where += ` AND (a.type IN ('notice', 'result', 'cancel') OR a.tender_id IN (
        SELECT t.id FROM tenders t WHERE t.status IN ('published', 'bidding', 'evaluation', 'completed')
      ))`;
    }

    const countResult = await query(`SELECT COUNT(*) as count FROM announcements a ${where}`, params);
    const total = parseInt(countResult.rows[0].count) || 0;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const listResult = await query(`
      SELECT a.*, t.title as tender_title
      FROM announcements a
      LEFT JOIN tenders t ON a.tender_id = t.id
      ${where}
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, [...params, parseInt(pageSize), offset]);

    res.json({ code: 200, data: { list: listResult.rows, total, page: parseInt(page), pageSize: parseInt(pageSize) } });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { tender_id, title, content, type } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ code: 400, message: '公告标题不能为空' });
    }

    const id = uuidv4();
    await query(`
      INSERT INTO announcements (id, tender_id, title, content, type)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, tender_id || null, title.trim(), content || '', type || 'notice']);

    res.json({ code: 200, message: '公告创建成功', data: { id } });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { title, content, type } = req.body;
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (title !== undefined) { updates.push(`title = $${paramIndex++}`); params.push(title.trim()); }
    if (content !== undefined) { updates.push(`content = $${paramIndex++}`); params.push(content); }
    if (type !== undefined) { updates.push(`type = $${paramIndex++}`); params.push(type); }

    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }

    params.push(req.params.id);
    await query(`UPDATE announcements SET ${updates.join(', ')} WHERE id = $${paramIndex}`, params);
    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    await query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
