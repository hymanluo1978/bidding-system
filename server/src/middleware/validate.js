/**
 * 参数校验中间件
 * 基于 Joi 的声明式请求校验
 */

const Joi = require('joi');

/**
 * 创建校验中间件
 * @param {Object} schemas - { body, query, params } 各自的 Joi schema
 * @param {Object} options - Joi 校验选项
 */
function validate(schemas, options = {}) {
  return (req, res, next) => {
    const errors = [];

    // 校验 body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
        ...options
      });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message.replace(/"/g, '')
        })));
      } else {
        req.body = value;
      }
    }

    // 校验 query
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        abortEarly: false,
        allowUnknown: true,
        stripUnknown: true,
        ...options
      });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message.replace(/"/g, '')
        })));
      } else {
        req.query = value;
      }
    }

    // 校验 params
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        abortEarly: false,
        allowUnknown: false,
        ...options
      });
      if (error) {
        errors.push(...error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message.replace(/"/g, '')
        })));
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        code: 400,
        message: '请求参数校验失败',
        errors
      });
    }

    next();
  };
}

// ==================== 常用校验规则 ====================

const schemas = {
  // 分页参数
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20)
  }),

  // UUID
  uuid: Joi.string().uuid().required(),

  // 非空文本
  nonEmptyText: Joi.string().trim().min(1).max(5000),

  // 用户名
  username: Joi.string().trim().min(2).max(50),

  // 密码
  password: Joi.string().min(6).max(100),

  // 手机号
  phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow('', null),

  // 邮箱
  email: Joi.string().email().max(255).allow('', null),

  // 金额
  money: Joi.number().min(0),

  // 百分比 (0-100)
  percent: Joi.number().min(0).max(100),

  // 投标状态
  bidStatus: Joi.string().valid('submitted', 'withdrawn', 'disqualified', 'won', 'lost'),

  // 招标状态
  tenderStatus: Joi.string().valid('draft', 'published', 'bidding', 'evaluation', 'completed', 'cancelled'),

  // 角色
  role: Joi.string().valid('admin', 'manager', 'supplier', 'judge'),
};

module.exports = { validate, schemas };
