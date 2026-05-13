const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, authenticate } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const Joi = require('joi');

// 登录
router.post('/login', validate({
  body: Joi.object({
    username: Joi.string().trim().required().messages({ 'any.required': '用户名不能为空' }),
    password: Joi.string().required().messages({ 'any.required': '密码不能为空' }),
    role: Joi.string().valid('admin', 'manager', 'supplier', 'judge').optional()
  })
}), async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    if (user.status === 0) {
      return res.status(403).json({ code: 403, message: '账号已被禁用，请联系管理员' });
    }

    const passwordValid = await User.verifyPassword(password, user.password);
    if (!passwordValid) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }

    const token = generateToken(user);
    res.json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          real_name: user.real_name,
          role: user.role,
          company_name: user.company_name
        }
      }
    });
  } catch (err) {
    next(err);
  }
});

// 修改密码（需要登录）
router.put('/change-password', authenticate, validate({
  body: Joi.object({
    old_password: Joi.string().required().messages({ 'any.required': '旧密码不能为空' }),
    new_password: Joi.string().min(6).required().messages({
      'any.required': '新密码不能为空',
      'string.min': '新密码长度不能少于6位'
    })
  })
}), async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 需要从数据库获取完整用户信息（含密码）
    const fullUser = await User.findByUsername(user.username);
    const passwordValid = await User.verifyPassword(old_password, fullUser.password);
    if (!passwordValid) {
      return res.status(400).json({ code: 400, message: '旧密码错误' });
    }

    await User.updatePassword(req.user.id, new_password);
    res.json({ code: 200, message: '密码修改成功' });
  } catch (err) {
    next(err);
  }
});

// 获取当前用户信息
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ code: 404, message: '用户不存在' });
  }
  res.json({ code: 200, data: user });
});

router.get('/session', authenticate, (req, res) => {
  res.json({
    code: 200,
    data: {
      id: req.user.id,
      username: req.user.username,
      real_name: req.user.real_name,
      role: req.user.role,
      status: req.user.status
    }
  });
});

module.exports = router;
