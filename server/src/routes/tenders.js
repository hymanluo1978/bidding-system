const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Tender = require('../models/Tender');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { query } = require('../config/database');
const dayjs = require('dayjs');
const { validate, schemas } = require('../middleware/validate');
const Joi = require('joi');

// 给招标数据添加 tenderNo 别名
function normalizeTender(item) {
  if (!item) return item;
  const result = { ...item };
  if (result.project_number && !result.tenderNo) {
    result.tenderNo = result.project_number;
  }
  return result;
}

const VALID_TRANSITIONS = {
  draft: ['published', 'cancelled'],
  published: ['bidding', 'cancelled'],
  bidding: ['evaluation', 'cancelled'],
  evaluation: ['completed', 'cancelled'],
  completed: [],
  cancelled: ['draft']
};

function validateStatusTransition(currentStatus, newStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    return `不允许从 '${currentStatus}' 状态变更为 '${newStatus}'，合法目标状态: [${(allowed || []).join(', ')}]`;
  }
  return null;
}

// 所有路由都需要认证
router.use((req, res, next) => {
  authenticate(req, res, next).catch(next);
});

// Dashboard 统计数据
router.get('/stats', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const statsResult = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) as total_tenders,
        COUNT(*) FILTER (WHERE status IN ('published', 'bidding', 'evaluation')) as ongoing_tenders,
        (SELECT COUNT(*) FROM users WHERE role = 'supplier' AND status = 1) as supplier_count,
        (SELECT COUNT(*) FROM judges j LEFT JOIN users u ON j.user_id = u.id WHERE u.status = 1) as judge_count
      FROM tenders
    `);
    const recentResult = await query(`
      SELECT t.*, u.real_name as creator_name,
        (SELECT COUNT(*) FROM bids WHERE tender_id = t.id) as bid_count
      FROM tenders t
      LEFT JOIN users u ON t.creator_id = u.id
      ORDER BY t.created_at DESC
      LIMIT 5
    `);
    const row = statsResult.rows[0];
    res.json({
      code: 200,
      data: {
        totalTenders: parseInt(row.total_tenders) || 0,
        ongoingTenders: parseInt(row.ongoing_tenders) || 0,
        supplierCount: parseInt(row.supplier_count) || 0,
        judgeCount: parseInt(row.judge_count) || 0,
        recentTenders: recentResult.rows.map(normalizeTender)
      }
    });
  } catch (err) {
    next(err);
  }
});

// 获取招标列表（管理员）
router.get('/', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { status, keyword, category, page = 1, pageSize = 20 } = req.query;
    const result = await Tender.findAll({
      status,
      keyword,
      category,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20
    });
    result.list = (result.list || []).map(normalizeTender);
    res.json({ code: 200, data: result });
  } catch (err) {
    next(err);
  }
});

// 供应商获取招标列表
router.get('/my-tenders', requireRole('supplier'), async (req, res, next) => {
  try {
    const { status, keyword, page = 1, pageSize = 20 } = req.query;
    const result = await Tender.findForSupplier(req.user.id, {
      status,
      keyword,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20
    });
    result.list = (result.list || []).map(normalizeTender);
    res.json({ code: 200, data: result });
  } catch (err) {
    next(err);
  }
});

// 获取招标详情
router.get('/:id', async (req, res, next) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res.status(404).json({ code: 404, message: '招标项目不存在' });
    }

    // 供应商只能查看已发布的招标
    if (req.user.role === 'supplier' && !['published', 'bidding', 'evaluation', 'completed'].includes(tender.status)) {
      return res.status(403).json({ code: 403, message: '无权查看此招标项目' });
    }

    res.json({ code: 200, data: normalizeTender(tender) });
  } catch (err) {
    next(err);
  }
});

// 创建招标项目
router.post('/', requireRole('admin', 'manager'), validate({
  body: Joi.object({
    title: Joi.string().trim().required().max(500).messages({ 'any.required': '招标标题不能为空' }),
    project_number: Joi.string().trim().optional(),
    tenderNo: Joi.string().trim().optional(),
    category: Joi.string().allow('', null).default(''),
    budget: Joi.number().min(0).default(0),
    description: Joi.string().allow('', null).default(''),
    requirements: Joi.string().allow('', null).default(''),
    qualification_requirements: Joi.string().allow('', null).default(''),
    qualification: Joi.string().allow('', null).optional(),
    bid_deadline: Joi.date().iso().allow(null),
    bidDeadline: Joi.date().iso().allow(null).optional(),
    open_bid_date: Joi.date().iso().allow(null),
    openTime: Joi.date().iso().allow(null).optional()
  })
}), async (req, res, next) => {
  try {
    const data = {
      ...req.body,
      project_number: req.body.project_number || req.body.tenderNo,
      qualification_requirements: req.body.qualification_requirements || req.body.qualification || '',
      bid_deadline: req.body.bid_deadline || req.body.bidDeadline,
      open_bid_date: req.body.open_bid_date || req.body.openTime,
    };

    if (!data.title || !data.project_number) {
      return res.status(400).json({ code: 400, message: '招标标题和项目编号不能为空' });
    }

    const tender = await Tender.create({
      ...data,
      creator_id: req.user.id
    });

    res.json({ code: 200, message: '招标项目创建成功', data: { ...tender, tenderNo: tender.project_number } });
  } catch (err) {
    if ((err?.message || '').includes('UNIQUE') || (err?.message || '').includes('duplicate') || (err?.code === '23505')) {
      return res.status(400).json({ code: 400, message: '项目编号已存在' });
    }
    next(err);
  }
});

// 更新招标项目
router.put('/:id', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res.status(404).json({ code: 404, message: '招标项目不存在' });
    }

    if (tender.status !== 'draft') {
      return res.status(400).json({ code: 400, message: '只有草稿状态的招标才能编辑' });
    }

    const data = {
      ...req.body,
      qualification_requirements: req.body.qualification_requirements || req.body.qualification,
      bid_deadline: req.body.bid_deadline || req.body.bidDeadline,
      open_bid_date: req.body.open_bid_date || req.body.openTime,
    };
    await Tender.update(req.params.id, data);
    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

// 发布招标
router.put('/:id/publish', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) return res.status(404).json({ code: 404, message: '招标项目不存在' });
    if (tender.status !== 'draft') return res.status(400).json({ code: 400, message: '只有草稿状态的招标才能发布' });

    console.log(`[Publish] Publishing tender ${req.params.id}, current status: ${tender.status}`);

    await Tender.update(req.params.id, {
      status: 'published',
      publish_date: dayjs().format('YYYY-MM-DD HH:mm:ss')
    });

    const updatedTender = await Tender.findById(req.params.id);
    console.log(`[Publish] Tender ${req.params.id} updated, new status: ${updatedTender?.status}`);

    res.json({ code: 200, message: '招标已发布', data: updatedTender });
  } catch (err) {
    console.error(`[Publish] Error publishing tender ${req.params.id}:`, err);
    next(err);
  }
});

// 变更招标状态（状态机）
router.put('/:id/status', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { status: newStatus } = req.body;
    if (!newStatus) {
      return res.status(400).json({ code: 400, message: '目标状态不能为空' });
    }

    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res.status(404).json({ code: 404, message: '招标项目不存在' });
    }

    const error = validateStatusTransition(tender.status, newStatus);
    if (error) {
      return res.status(400).json({ code: 400, message: error });
    }

    const updateData = { status: newStatus };
    if (newStatus === 'published') {
      updateData.publish_date = dayjs().format('YYYY-MM-DD HH:mm:ss');
    }

    await Tender.update(req.params.id, updateData);
    const updatedTender = await Tender.findById(req.params.id);
    res.json({ code: 200, message: '状态变更成功', data: normalizeTender(updatedTender) });
  } catch (err) {
    next(err);
  }
});

// 上传招标书文件
router.post('/:id/upload', requireRole('admin', 'manager'), (req, res, next) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 400, message: '文件大小超过限制（最大50MB）' });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ code: 400, message: '文件数量超过限制（最多10个）' });
      }
      return res.status(400).json({ code: 400, message: err.message || '文件上传失败' });
    }
    
    (async () => {
      try {
        const tender = await Tender.findById(req.params.id);
        if (!tender) {
          return res.status(404).json({ code: 404, message: '招标项目不存在' });
        }

        const files = (req.files || []).map(file => ({
          id: uuidv4(),
          name: file.originalname,
          path: `/uploads/tenders/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype,
          uploaded_at: dayjs().format('YYYY-MM-DD HH:mm:ss')
        }));

        // 将新附件合并到现有附件中
        const existingAttachments = tender.attachments || [];
        const newAttachments = [...existingAttachments, ...files];
        
        // 更新数据库
        await Tender.update(req.params.id, { attachments: newAttachments });

        res.json({ code: 200, message: '文件上传成功', data: files });
      } catch (err) {
        console.error('Upload error:', err);
        next(err);
      }
    })();
  });
});

// 删除招标附件
router.delete('/:id/attachments/:fileId', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res.status(404).json({ code: 404, message: '招标项目不存在' });
    }

    const existingAttachments = tender.attachments || [];
    const fileIndex = existingAttachments.findIndex(f => f.id === req.params.fileId);
    if (fileIndex === -1) {
      return res.status(404).json({ code: 404, message: '附件不存在' });
    }

    const fileToDelete = existingAttachments[fileIndex];
    if (fileToDelete.path) {
      const UPLOAD_DIR = process.env.UPLOAD_DIR || require('path').resolve(__dirname, '..', '..', 'uploads');
      const fullPath = require('path').resolve(UPLOAD_DIR, fileToDelete.path.replace(/^\/uploads\//, ''));
      if (fullPath.startsWith(require('path').resolve(UPLOAD_DIR))) {
        try { require('fs').unlinkSync(fullPath); } catch (e) { /* file may not exist on disk */ }
      }
    }

    existingAttachments.splice(fileIndex, 1);
    await Tender.update(req.params.id, { attachments: existingAttachments });
    res.json({ code: 200, message: '附件已删除' });
  } catch (err) {
    next(err);
  }
});

// 删除招标项目（仅系统管理员）
router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const tender = await Tender.findById(req.params.id);
    if (!tender) {
      return res.status(404).json({ code: 404, message: '招标项目不存在' });
    }
    const { transaction } = require('../utils/transaction');
    await transaction(async (client) => {
      const bidIds = await client.query('SELECT id FROM bids WHERE tender_id = $1', [req.params.id]);
      if (bidIds.rows.length > 0) {
        const ids = bidIds.rows.map(r => r.id);
        await client.query('DELETE FROM evaluations WHERE bid_id = ANY($1)', [ids]);
        await client.query('DELETE FROM clarification_responses WHERE request_id IN (SELECT id FROM clarification_requests WHERE bid_id = ANY($1))', [ids]);
        await client.query('DELETE FROM clarification_requests WHERE bid_id = ANY($1)', [ids]);
        await client.query('DELETE FROM bids WHERE tender_id = $1', [req.params.id]);
      }
      await client.query('DELETE FROM evaluation_committees WHERE tender_id = $1', [req.params.id]);
      await client.query('DELETE FROM evaluation_weights WHERE tender_id = $1', [req.params.id]);
      await client.query('DELETE FROM clarification_requests WHERE tender_id = $1', [req.params.id]);
      await client.query('DELETE FROM announcements WHERE tender_id = $1', [req.params.id]);
      await client.query('DELETE FROM tenders WHERE id = $1', [req.params.id]);
    });
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
