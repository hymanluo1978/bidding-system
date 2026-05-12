const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// 所有路由都需要认证
router.use((req, res, next) => {
  authenticate(req, res, next).catch(next);
});

// 获取招标项目的权重配置
router.get('/:tenderId', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM evaluation_weights WHERE tender_id = $1', [req.params.tenderId]);
    const weight = result.rows[0];

    if (!weight) {
      return res.json({
        code: 200,
        data: {
          tender_id: req.params.tenderId,
          technical_weight: 40,
          business_weight: 30,
          price_weight: 30
        }
      });
    }

    res.json({ code: 200, data: weight });
  } catch (err) {
    next(err);
  }
});

// 创建或更新权重配置
router.put('/:tenderId', requireRole('admin', 'manager'), async (req, res, next) => {
  try {
    const { technical_weight, business_weight, price_weight } = req.body;

    const techWeight = Math.max(0, Math.min(100, parseFloat(technical_weight) || 0));
    const bizWeight = Math.max(0, Math.min(100, parseFloat(business_weight) || 0));
    const priceWt = Math.max(0, Math.min(100, parseFloat(price_weight) || 0));

    if (techWeight + bizWeight + priceWt !== 100) {
      return res.status(400).json({ code: 400, message: '三个权重之和必须等于100%' });
    }

    const existing = await query('SELECT id FROM evaluation_weights WHERE tender_id = $1', [req.params.tenderId]);

    if (existing.rows.length > 0) {
      await query(`
        UPDATE evaluation_weights
        SET technical_weight = $1, business_weight = $2, price_weight = $3, updated_at = CURRENT_TIMESTAMP
        WHERE tender_id = $4
      `, [techWeight, bizWeight, priceWt, req.params.tenderId]);
    } else {
      await query(`
        INSERT INTO evaluation_weights (id, tender_id, technical_weight, business_weight, price_weight)
        VALUES (gen_random_uuid(), $1, $2, $3, $4)
      `, [req.params.tenderId, techWeight, bizWeight, priceWt]);
    }

    res.json({ code: 200, message: '权重配置已保存' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
