const express = require('express');
const router = express.Router();
const Bid = require('../models/Bid');
const Tender = require('../models/Tender');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { checkBidDeadline } = require('../middleware/bidDeadline');
const dayjs = require('dayjs');
const { validate, schemas } = require('../middleware/validate');
const Joi = require('joi');

// 字段名映射辅助函数
function normalizeFields(data, mapping) {
  if (!data || typeof data !== 'object') return data;
  const result = { ...data };
  Object.entries(mapping).forEach(([from, to]) => {
    if (from !== to && from in result) {
      result[to] = result[from];
      delete result[from];
    }
  });
  return result;
}

// 所有路由都需要认证
router.use((req, res, next) => {
  authenticate(req, res, next).catch(next);
});

// 供应商提交投标
router.post('/', requireRole('supplier'), checkBidDeadline, upload.array('files', 10), async (req, res, next) => {
  try {
    const normalized = normalizeFields(req.body, {
      tenderId: 'tender_id',
      price: 'bid_price',
      tender_id: 'tender_id',
      technicalProposal: 'technical_proposal',
      commercialProposal: 'business_proposal'
    });
    const { tender_id, bid_price, technical_proposal, business_proposal } = normalized;

    if (!tender_id || !bid_price) {
      return res.status(400).json({ code: 400, message: '招标项目ID和报价不能为空' });
    }

    const bidPrice = parseFloat(bid_price);
    if (isNaN(bidPrice) || bidPrice <= 0) {
      return res.status(400).json({ code: 400, message: '报价必须为正数' });
    }

    // 检查是否已投标（包含有效投标，排除已撤回的）
    const existing = await Bid.findByTenderAndSupplier(tender_id, req.user.id);
    if (existing && existing.status !== 'withdrawn') {
      return res.status(400).json({ code: 400, message: '您已对此招标项目提交过有效投标' });
    }

    // 处理上传的附件
    const attachments = (req.files || []).map(file => ({
      name: file.originalname,
      path: `/uploads/bids/${file.filename}`,
      size: file.size,
      mimetype: file.mimetype
    }));

    const bid = await Bid.create({
      tender_id,
      supplier_id: req.user.id,
      bid_price: bidPrice,
      technical_proposal: technical_proposal || '',
      business_proposal: business_proposal || '',
      attachments
    });

    res.json({ code: 200, message: '投标提交成功', data: bid });
  } catch (err) {
    next(err);
  }
});

// 供应商获取自己的投标列表
router.get('/my-bids', requireRole('supplier'), async (req, res, next) => {
  try {
    const bids = await Bid.findBySupplier(req.user.id);
    res.json({ code: 200, data: bids });
  } catch (err) {
    next(err);
  }
});

// 供应商查看自己在某个招标项目的投标
router.get('/my-bid/:tenderId', requireRole('supplier'), async (req, res, next) => {
  try {
    const bid = await Bid.findByTenderAndSupplier(req.params.tenderId, req.user.id);
    if (!bid) {
      return res.status(404).json({ code: 404, message: '未找到投标记录' });
    }
    res.json({ code: 200, data: bid });
  } catch (err) {
    next(err);
  }
});

// 管理员/评委获取招标项目的所有投标
router.get('/tender/:tenderId', requireRole('admin', 'manager', 'judge'), async (req, res, next) => {
  try {
    const bids = await Bid.findByTenderId(req.params.tenderId);
    res.json({ code: 200, data: bids });
  } catch (err) {
    next(err);
  }
});

// 获取报价汇总
router.get('/tender/:tenderId/summary', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const summary = await Bid.getPriceSummary(req.params.tenderId);
    res.json({ code: 200, data: summary });
  } catch (err) {
    next(err);
  }
});

// 供应商撤回投标
router.put('/:id/withdraw', requireRole('supplier'), async (req, res, next) => {
  try {
    if (!req.body.tender_id) {
      return res.status(400).json({ code: 400, message: '招标项目ID不能为空' });
    }
    const bid = await Bid.findByTenderAndSupplier(req.body.tender_id, req.user.id);
    if (!bid || bid.id !== req.params.id) {
      return res.status(404).json({ code: 404, message: '投标记录不存在' });
    }
    if (bid.status === 'withdrawn') {
      return res.status(400).json({ code: 400, message: '投标已撤回，无需重复操作' });
    }

    const tender = await Tender.findById(bid.tender_id);
    if (tender?.bid_deadline && dayjs().isAfter(dayjs(tender.bid_deadline))) {
      return res.status(400).json({ code: 400, message: '投标截止时间已过，无法撤回' });
    }

    await Bid.update(req.params.id, { status: 'withdrawn' });
    res.json({ code: 200, message: '投标已撤回' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
