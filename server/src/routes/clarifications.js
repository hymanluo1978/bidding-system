const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const upload = require('../middleware/upload');

// 所有路由都需要认证
router.use((req, res, next) => {
  authenticate(req, res, next).catch(next);
});

// 管理员/评委：获取某招标项目的所有询标澄清列表
router.get('/tender/:tenderId', requireRole('admin', 'manager', 'judge'), async (req, res, next) => {
  try {
    const result = await query(`
      SELECT cr.*, b.bid_price, u.company_name, u.real_name as supplier_name,
        (SELECT json_agg(json_build_object(
          'id', crr.id,
          'response_content', crr.response_content,
          'response_date', crr.response_date,
          'attachments', crr.attachments
        ) ORDER BY crr.response_date)
        FROM clarification_responses crr
        WHERE crr.request_id = cr.id) as responses
      FROM clarification_requests cr
      LEFT JOIN bids b ON cr.bid_id = b.id
      LEFT JOIN users u ON b.supplier_id = u.id
      WHERE cr.tender_id = $1
      ORDER BY cr.request_date DESC
    `, [req.params.tenderId]);

    res.json({ code: 200, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 供应商：获取自己的询标澄清列表
router.get('/my-requests', requireRole('supplier'), async (req, res, next) => {
  try {
    const result = await query(`
      SELECT cr.*, t.title as tender_title, t.project_number,
        (SELECT json_agg(json_build_object(
          'id', crr.id,
          'response_content', crr.response_content,
          'response_date', crr.response_date,
          'attachments', crr.attachments
        ) ORDER BY crr.response_date)
        FROM clarification_responses crr
        WHERE crr.request_id = cr.id) as responses
      FROM clarification_requests cr
      LEFT JOIN bids b ON cr.bid_id = b.id
      LEFT JOIN tenders t ON cr.tender_id = t.id
      WHERE b.supplier_id = $1
      ORDER BY cr.request_date DESC
    `, [req.user.id]);

    res.json({ code: 200, data: result.rows });
  } catch (err) {
    next(err);
  }
});

// 管理员/评委：创建询标请求
router.post('/', requireRole('admin', 'manager', 'judge'), async (req, res, next) => {
  try {
    const { tender_id, bid_id, request_content } = req.body;

    if (!tender_id || !bid_id || !request_content || !request_content.trim()) {
      return res.status(400).json({ code: 400, message: '招标项目ID、投标ID和询标内容不能为空' });
    }

    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    await query(`
      INSERT INTO clarification_requests (id, tender_id, bid_id, request_content)
      VALUES ($1, $2, $3, $4)
    `, [id, tender_id, bid_id, request_content.trim()]);

    res.json({ code: 200, message: '询标请求已提交', data: { id } });
  } catch (err) {
    next(err);
  }
});

// 供应商：提交澄清回复
router.post('/:requestId/respond', requireRole('supplier'), upload.array('files', 5), (req, res, next) => {
  const { response_content } = req.body;

  if (!response_content || !response_content.trim()) {
    return res.status(400).json({ code: 400, message: '回复内容不能为空' });
  }

  (async () => {
    try {
      const requestResult = await query('SELECT * FROM clarification_requests WHERE id = $1', [req.params.requestId]);
      const request = requestResult.rows[0];

      if (!request) {
        return res.status(404).json({ code: 404, message: '询标请求不存在' });
      }

      const bidResult = await query('SELECT supplier_id FROM bids WHERE id = $1', [request.bid_id]);
      if (!bidResult.rows[0] || bidResult.rows[0].supplier_id !== req.user.id) {
        return res.status(403).json({ code: 403, message: '无权回复此询标请求' });
      }

      const files = (req.files || []).map(file => ({
        id: uuidv4(),
        name: file.originalname,
        path: `/uploads/clarifications/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype
      }));

      await query(`
        INSERT INTO clarification_responses (id, request_id, response_content, attachments)
        VALUES ($1, $2, $3, $4)
      `, [uuidv4(), req.params.requestId, response_content, JSON.stringify(files)]);

      await query(`
        UPDATE clarification_requests SET status = 'responded', updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, [req.params.requestId]);

      res.json({ code: 200, message: '回复提交成功', data: files });
    } catch (err) {
      next(err);
    }
  })();
});

// 管理员：关闭询标请求
router.put('/:requestId/close', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    await query(`
      UPDATE clarification_requests SET status = 'closed', updated_at = CURRENT_TIMESTAMP WHERE id = $1
    `, [req.params.requestId]);
    res.json({ code: 200, message: '询标请求已关闭' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
