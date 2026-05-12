const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const Joi = require('joi');

router.get('/', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { role, keyword, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);
    
    let query = 'SELECT id, username, real_name, role, phone, email, company_name, status, created_at FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (role) {
      query += ` AND role = $${paramIndex++}`;
      params.push(role);
    }
    
    if (keyword) {
      query += ` AND (username LIKE $${paramIndex} OR real_name LIKE $${paramIndex} OR company_name LIKE $${paramIndex})`;
      params.push(`%${keyword}%`);
      paramIndex++;
    }
    
    const countQuery = query.replace('SELECT id, username, real_name, role, phone, email, company_name, status, created_at', 'SELECT COUNT(*)');
    const countResult = await require('../config/database').query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(pageSize), offset);
    
    const result = await require('../config/database').query(query, params);
    
    res.json({
      code: 200,
      data: {
        list: result.rows,
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, requireRole('admin'), validate({
  body: Joi.object({
    username: Joi.string().trim().min(3).max(50).required().messages({
      'any.required': '用户名不能为空',
      'string.min': '用户名长度不能少于3位',
      'string.max': '用户名长度不能超过50位'
    }),
    password: Joi.string().min(6).required().messages({
      'any.required': '密码不能为空',
      'string.min': '密码长度不能少于6位'
    }),
    real_name: Joi.string().trim().max(100).required().messages({
      'any.required': '真实姓名不能为空'
    }),
    role: Joi.string().valid('admin', 'manager', 'supplier', 'judge').required().messages({
      'any.required': '角色不能为空',
      'any.only': '角色必须是 admin, manager, supplier 或 judge'
    }),
    phone: Joi.string().allow('').max(50),
    email: Joi.string().email().allow('').max(255),
    company_name: Joi.string().allow('').max(255)
  })
}), async (req, res, next) => {
  try {
    const { username, password, real_name, role, phone, email, company_name } = req.body;
    
    const existing = await require('../models/User').findByUsername(username);
    if (existing) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await require('../config/database').query(
      `INSERT INTO users (username, password, real_name, role, phone, email, company_name, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
       RETURNING id, username, real_name, role, phone, email, company_name, status`,
      [username, hashedPassword, real_name, role, phone || '', email || '', company_name || '']
    );
    
    res.json({
      code: 200,
      message: '用户创建成功',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, requireRole('admin'), validate({
  body: Joi.object({
    real_name: Joi.string().trim().max(100),
    phone: Joi.string().allow('').max(50),
    email: Joi.string().email().allow('').max(255),
    company_name: Joi.string().allow('').max(255),
    status: Joi.number().valid(0, 1),
    role: Joi.string().valid('admin', 'manager', 'supplier', 'judge')
  })
}), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { real_name, phone, email, company_name, status, role } = req.body;
    
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (real_name !== undefined) {
      updates.push(`real_name = $${paramIndex++}`);
      params.push(real_name);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      params.push(phone);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    if (company_name !== undefined) {
      updates.push(`company_name = $${paramIndex++}`);
      params.push(company_name);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      params.push(role);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }
    
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    
    params.push(id);
    const result = await require('../config/database').query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, username, real_name, role, phone, email, company_name, status`,
      params
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    
    res.json({
      code: 200,
      message: '更新成功',
      data: result.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/password', authenticate, requireRole('admin'), validate({
  body: Joi.object({
    new_password: Joi.string().min(6).required().messages({
      'any.required': '新密码不能为空',
      'string.min': '密码长度不能少于6位'
    })
  })
}), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;
    
    const hashedPassword = await bcrypt.hash(new_password, 10);
    
    const result = await require('../config/database').query(
      `UPDATE users SET password = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id`,
      [hashedPassword, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    
    res.json({ code: 200, message: '密码重置成功' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (id === req.user.id) {
      return res.status(400).json({ code: 400, message: '不能删除自己' });
    }
    
    const result = await require('../config/database').query(
      `DELETE FROM users WHERE id = $1 AND role != 'admin' RETURNING id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ code: 400, message: '无法删除该用户（可能是管理员或用户不存在）' });
    }
    
    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
