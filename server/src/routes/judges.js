const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const { query } = require('../config/database');
const { transaction } = require('../utils/transaction');
const { validate, schemas } = require('../middleware/validate');
const Joi = require('joi');

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

// 所有路由都需要管理员权限
router.use((req, res, next) => {
  authenticate(req, res, next).catch(next);
});
router.use(requireRole('admin', 'manager'));

// 获取评委列表
router.get('/', async (req, res, next) => {
  try {
    const judges = await query(`
      SELECT j.*, u.username, u.real_name, u.phone, u.email, u.status
      FROM judges j
      LEFT JOIN users u ON j.user_id = u.id
      ORDER BY j.created_at DESC
    `);
    res.json({ code: 200, data: judges.rows });
  } catch (err) {
    next(err);
  }
});

// 获取单个评委
router.get('/:id', async (req, res, next) => {
  try {
    const judgeResult = await query('SELECT * FROM judges WHERE id = $1', [req.params.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(404).json({ code: 404, message: '评委不存在' });
    }
    res.json({ code: 200, data: judge });
  } catch (err) {
    next(err);
  }
});

// 创建评委（事务保障）
router.post('/', validate({
  body: Joi.object({
    username: Joi.string().trim().min(2).max(50).required().messages({
      'any.required': '用户名不能为空',
      'string.min': '用户名至少2个字符'
    }),
    password: Joi.string().min(6).max(100).required().messages({
      'any.required': '密码不能为空',
      'string.min': '密码至少6位'
    }),
    real_name: Joi.string().trim().allow('', null).default(''),
    name: Joi.string().optional(),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow('', null).default(''),
    email: Joi.string().email().allow('', null).default(''),
    specialty: Joi.string().allow('', null).default(''),
    title: Joi.string().allow('', null).default('')
  })
}), async (req, res, next) => {
  try {
    const normalized = normalizeFields(req.body, { name: 'real_name' });
    const { username, password, real_name, phone, email, specialty, title: judgeTitle } = normalized;
    if (!username || !password || !real_name) {
      return res.status(400).json({ code: 400, message: '用户名、密码和姓名不能为空' });
    }

    const existing = await User.findByUsername(username);
    if (existing) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }

    const result = await transaction(async (client) => {
      // 创建用户
      const userResult = await client.query(`
        INSERT INTO users (username, password, real_name, role, phone, email)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [username, await require('bcryptjs').hash(password, 10), real_name, 'judge', phone || '', email || '']);

      // 创建评委记录
      const judgeId = uuidv4();
      await client.query(`
        INSERT INTO judges (id, user_id, specialty, title, phone)
        VALUES ($1, $2, $3, $4, $5)
      `, [judgeId, userResult.rows[0].id, specialty || '', judgeTitle || '', phone || '']);

      return { id: judgeId, user_id: userResult.rows[0].id };
    });

    res.json({ code: 200, message: '评委创建成功', data: result });
  } catch (err) {
    next(err);
  }
});

// 更新评委信息
router.put('/:id', async (req, res, next) => {
  try {
    const judgeResult = await query('SELECT * FROM judges WHERE id = $1', [req.params.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(404).json({ code: 404, message: '评委不存在' });
    }

    const normalized = normalizeFields(req.body, { name: 'real_name' });
    const { specialty, title: judgeTitle, phone, real_name } = normalized;

    if (specialty !== undefined || judgeTitle !== undefined || phone !== undefined) {
      await query(`
        UPDATE judges SET
          specialty = COALESCE(NULLIF($1, ''), specialty),
          title = COALESCE(NULLIF($2, ''), title),
          phone = COALESCE(NULLIF($3, ''), phone)
        WHERE id = $4
      `, [
        specialty || '',
        judgeTitle || '',
        phone || '',
        req.params.id
      ]);
    }

    if (real_name) {
      await User.update(judge.user_id, { real_name });
    }

    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

// 重置评委密码
router.put('/:id/reset-password', async (req, res, next) => {
  try {
    const judgeResult = await query('SELECT * FROM judges WHERE id = $1', [req.params.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(404).json({ code: 404, message: '评委不存在' });
    }

    const { new_password } = req.body;
    const password = new_password || '123456';
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '新密码至少6位' });
    }

    await User.updatePassword(judge.user_id, password);
    res.json({ code: 200, message: '密码已重置成功' });
  } catch (err) {
    next(err);
  }
});

// 删除评委
router.delete('/:id', async (req, res, next) => {
  try {
    const judgeResult = await query('SELECT * FROM judges WHERE id = $1', [req.params.id]);
    const judge = judgeResult.rows?.[0];
    if (!judge) {
      return res.status(404).json({ code: 404, message: '评委不存在' });
    }

    await transaction(async (client) => {
      await client.query('DELETE FROM judges WHERE id = $1', [req.params.id]);
      await client.query('DELETE FROM users WHERE id = $1', [judge.user_id]);
    });

    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
