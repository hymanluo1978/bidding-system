const express = require('express');
const router = express.Router();
const Evaluation = require('../models/Evaluation');
const Bid = require('../models/Bid');
const Tender = require('../models/Tender');
const { authenticate, requireRole } = require('../middleware/auth');
const { query } = require('../config/database');
const { transaction } = require('../utils/transaction');
const { validate, schemas } = require('../middleware/validate');
const Joi = require('joi');

// 字段名映射辅助函数：将 camelCase 转为 snake_case
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

// 管理员：组建评标委员会
router.post('/committee', requireRole('admin', 'manager'), validate({
  body: Joi.object({
    tender_id: Joi.string().uuid().required().messages({ 'any.required': '招标项目ID不能为空' }),
    tenderId: Joi.string().uuid().optional(),
    judge_ids: Joi.array().items(Joi.string().uuid()).min(1).required().messages({
      'any.required': '评委列表不能为空',
      'array.min': '至少需要一位评委'
    }),
    leader_id: Joi.string().uuid().required().messages({ 'any.required': '主任评委不能为空' }),
    leaderId: Joi.string().uuid().optional()
  })
}), async (req, res, next) => {
  try {
    const normalized = normalizeFields(req.body, { tenderId: 'tender_id' });
    const { tender_id, judge_ids, leader_id } = normalized;

    await transaction(async (client) => {
      // 删除旧的委员会
      await client.query('DELETE FROM evaluation_committees WHERE tender_id = $1', [tender_id]);

      // 创建新的委员会
      const { v4: uuidv4 } = require('uuid');
      const id = uuidv4();
      await client.query(`
        INSERT INTO evaluation_committees (id, tender_id, judge_ids, leader_id)
        VALUES ($1, $2, $3, $4)
      `, [id, tender_id, JSON.stringify(judge_ids), leader_id]);

      // 更新招标状态为评标中
      await client.query("UPDATE tenders SET status = 'evaluation', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [tender_id]);
    });

    res.json({ code: 200, message: '评标委员会组建成功' });
  } catch (err) {
    next(err);
  }
});

// 管理员：获取评标委员会信息
router.get('/committee/:tenderId', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const committeeResult = await query('SELECT * FROM evaluation_committees WHERE tender_id = $1', [req.params.tenderId]);
    const committee = committeeResult.rows?.[0];

    if (!committee) {
      return res.json({ code: 200, data: null });
    }

    // 获取评委详细信息
    let judgeIds;
    try {
      judgeIds = JSON.parse(committee.judge_ids);
    } catch (e) {
      judgeIds = [];
    }
    if (!Array.isArray(judgeIds)) {
      judgeIds = [];
    }
    let judges = { rows: [] };
    if (judgeIds.length > 0) {
      const placeholders = judgeIds.map((_, i) => `$${i + 1}`).join(',');
      judges = await query(`
        SELECT j.id, j.specialty, j.title, u.username, u.real_name, u.phone
        FROM judges j
        LEFT JOIN users u ON j.user_id = u.id
        WHERE j.id IN (${placeholders})
      `, judgeIds);
    }

    res.json({ code: 200, data: { ...committee, judges: judges.rows, judge_ids: judgeIds } });
  } catch (err) {
    next(err);
  }
});

// 评委：提交评分
router.post('/score', requireRole('judge'), async (req, res, next) => {
  try {
    const normalized = normalizeFields(req.body, {
      tenderId: 'tender_id',
      bidId: 'bid_id',
      technicalScore: 'technical_score',
      commercialScore: 'business_score',
      priceScore: 'price_score'
    });
    const { tender_id, bid_id, technical_score, business_score, price_score, comment } = normalized;

    if (!tender_id || !bid_id) {
      return res.status(400).json({ code: 400, message: '招标项目ID和投标ID不能为空' });
    }

    // 获取评委ID
    const judgeResult = await query('SELECT id FROM judges WHERE user_id = $1', [req.user.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(403).json({ code: 403, message: '您不是评委' });
    }

    // 校验分数范围
    const tScore = Math.max(0, Math.min(100, parseFloat(technical_score) || 0));
    const bScore = Math.max(0, Math.min(100, parseFloat(business_score) || 0));
    const pScore = Math.max(0, Math.min(100, parseFloat(price_score) || 0));

    let weights = { technical: 40, business: 30, price: 30 };
    try {
      const weightResult = await query('SELECT * FROM evaluation_weights WHERE tender_id = $1', [tender_id]);
      if (weightResult.rows[0]) {
        weights = {
          technical: parseFloat(weightResult.rows[0].technical_weight) || 40,
          business: parseFloat(weightResult.rows[0].business_weight) || 30,
          price: parseFloat(weightResult.rows[0].price_weight) || 30
        };
      }
    } catch (e) { /* use defaults */ }

    const total_score = parseFloat(
      (tScore * weights.technical + bScore * weights.business + pScore * weights.price) / 100
    ).toFixed(2);

    await Evaluation.createOrUpdate({
      tender_id,
      bid_id,
      judge_id: judge.id,
      technical_score: tScore,
      business_score: bScore,
      price_score: pScore,
      total_score,
      comment: comment || ''
    });

    res.json({ code: 200, message: '评分提交成功' });
  } catch (err) {
    next(err);
  }
});

// 评委：获取我的评标任务列表
router.get('/my-tasks', requireRole('judge'), async (req, res, next) => {
  try {
    const judgeResult = await query('SELECT id FROM judges WHERE user_id = $1', [req.user.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(403).json({ code: 403, message: '您不是评委' });
    }

    const committees = await query(
      `SELECT ec.*, t.title, t.project_number, t.status, t.bid_deadline
       FROM evaluation_committees ec
       LEFT JOIN tenders t ON ec.tender_id = t.id
       WHERE ec.judge_ids @> $1::jsonb
       ORDER BY t.created_at DESC`,
      [JSON.stringify(judge.id)]
    );

    const tasks = await Promise.all((committees?.rows || []).map(async (c) => {
      const bidCountResult = await query(
        "SELECT COUNT(*) as count FROM bids WHERE tender_id = $1 AND status = 'submitted'",
        [c.tender_id]
      );
      const scoredCountResult = await query(
        'SELECT COUNT(*) as count FROM evaluations WHERE tender_id = $1 AND judge_id = $2',
        [c.tender_id, judge.id]
      );
      return {
        tender_id: c.tender_id,
        tenderId: c.tender_id,
        project_number: c.project_number,
        tender_title: c.title,
        bid_deadline: c.bid_deadline,
        status: c.status,
        bidCount: parseInt(bidCountResult.rows[0].count, 10),
        scoredCount: parseInt(scoredCountResult.rows[0].count, 10),
      };
    }));

    res.json({ code: 200, data: tasks });
  } catch (err) {
    next(err);
  }
});

// 评委：获取自己需要评审的投标列表（指定招标）
router.get('/my-tasks/:tenderId', requireRole('judge'), async (req, res, next) => {
  try {
    const judgeResult = await query('SELECT id FROM judges WHERE user_id = $1', [req.user.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(403).json({ code: 403, message: '您不是评委' });
    }

    const bids = await Bid.findByTenderId(req.params.tenderId);
    const myScores = await Evaluation.findByTenderAndJudge(req.params.tenderId, judge.id);
    const scoredBidIds = new Set(myScores.map(s => s.bid_id));

    const tasks = bids.map(bid => ({
      ...bid,
      has_scored: scoredBidIds.has(bid.id),
      my_score: myScores.find(s => s.bid_id === bid.id) || null
    }));

    res.json({ code: 200, data: tasks });
  } catch (err) {
    next(err);
  }
});

// 管理员：获取评标结果
router.get('/result/:tenderId', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    let weights = { technical: 40, business: 30, price: 30 };

    const weightResult = await query('SELECT * FROM evaluation_weights WHERE tender_id = $1', [req.params.tenderId]);
    const savedWeight = weightResult.rows[0];
    if (savedWeight) {
      weights = {
        technical: parseFloat(savedWeight.technical_weight) || 40,
        business: parseFloat(savedWeight.business_weight) || 30,
        price: parseFloat(savedWeight.price_weight) || 30
      };
    } else if (req.query.technical || req.query.business || req.query.price) {
      weights = {
        technical: Math.max(0, Math.min(100, parseFloat(req.query.technical) || 0)),
        business: Math.max(0, Math.min(100, parseFloat(req.query.business) || 0)),
        price: Math.max(0, Math.min(100, parseFloat(req.query.price) || 0))
      };
    }

    const result = await Evaluation.calculateResult(req.params.tenderId, weights);
    res.json({ code: 200, data: result });
  } catch (err) {
    next(err);
  }
});

// 管理员：确认评标结果（事务保障）
router.post('/confirm-result', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const normalized = normalizeFields(req.body, { tenderId: 'tender_id', winnerId: 'winner_bid_id' });
    const { tender_id, winner_bid_id } = normalized;

    if (!tender_id || !winner_bid_id) {
      return res.status(400).json({ code: 400, message: '参数不完整' });
    }

    await transaction(async (client) => {
      // 更新中标状态
      await client.query('UPDATE bids SET status = $1 WHERE id = $2', ['won', winner_bid_id]);
      await client.query(
        "UPDATE bids SET status = $1 WHERE tender_id = $2 AND id != $3 AND status = 'submitted'",
        ['lost', tender_id, winner_bid_id]
      );
      // 更新招标状态为已完成
      await client.query(
        'UPDATE tenders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['completed', tender_id]
      );
    });

    res.json({ code: 200, message: '评标结果已确认' });
  } catch (err) {
    next(err);
  }
});

// 管理员：导出评标结果
router.get('/export/:tenderId', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    let weights = { technical: 40, business: 30, price: 30 };
    const weightResult = await query('SELECT * FROM evaluation_weights WHERE tender_id = $1', [req.params.tenderId]);
    if (weightResult.rows[0]) {
      weights = {
        technical: parseFloat(weightResult.rows[0].technical_weight) || 40,
        business: parseFloat(weightResult.rows[0].business_weight) || 30,
        price: parseFloat(weightResult.rows[0].price_weight) || 30
      };
    }

    const result = await Evaluation.calculateResult(req.params.tenderId, weights);
    const tenderResult = await query('SELECT title, project_number FROM tenders WHERE id = $1', [req.params.tenderId]);
    const tender = tenderResult.rows[0] || {};

    const header = `招标项目: ${tender.title || ''}\n项目编号: ${tender.project_number || ''}\n权重配置: 技术${weights.technical}% 商务${weights.business}% 价格${weights.price}%\n\n排名,供应商,公司,投标报价,技术分,商务分,价格分,加权总分,评委数\n`;
    const rows = (result.results || []).map((r, idx) =>
      `${idx + 1},"${r.real_name || ''}","${r.company_name || ''}",${r.bid_price || 0},${r.avg_technical || 0},${r.avg_business || 0},${r.avg_price || 0},${r.avg_total || 0},${r.eval_count || 0}`
    ).join('\n');

    const csv = '\uFEFF' + header + rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="evaluation_${tender.project_number || req.params.tenderId}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
