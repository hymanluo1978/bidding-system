const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
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

// 获取供应商列表
router.get('/', async (req, res, next) => {
  try {
    const { status, keyword, page = 1, pageSize = 20 } = req.query;
    const result = await User.findAll({
      role: 'supplier',
      status,
      keyword,
      page: parseInt(page, 10) || 1,
      pageSize: parseInt(pageSize, 10) || 20
    });
    res.json({ code: 200, data: result });
  } catch (err) {
    next(err);
  }
});

// 导出供应商CSV
router.get('/export', async (req, res, next) => {
  try {
    const result = await User.findAll({ role: 'supplier', pageSize: 10000 });
    const list = result.list || [];

    const header = '用户名,姓名,公司,电话,邮箱,状态\n';
    const rows = list.map(s =>
      `"${s.username}","${s.real_name || ''}","${s.company_name || ''}","${s.phone || ''}","${s.email || ''}","${s.status === 1 ? '正常' : '已禁用'}"`
    ).join('\n');

    const csv = '\uFEFF' + header + rows;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="suppliers.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// 获取供应商详情
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'supplier') {
      return res.status(404).json({ code: 404, message: '供应商不存在' });
    }
    res.json({ code: 200, data: user });
  } catch (err) {
    next(err);
  }
});

// 创建供应商
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
    real_name: Joi.string().allow('', null).default(''),
    name: Joi.string().allow('', null).optional(),
    phone: Joi.string().pattern(/^1[3-9]\d{9}$/).allow('', null).default(''),
    email: Joi.string().email().allow('', null).default(''),
    company_name: Joi.string().allow('', null).default(''),
    company: Joi.string().allow('', null).optional()
  })
}), async (req, res, next) => {
  try {
    const normalized = normalizeFields(req.body, { name: 'real_name', company: 'company_name' });
    const { username, password, real_name, phone, email, company_name } = normalized;

    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
    }

    const existing = await User.findByUsername(username);
    if (existing) {
      return res.status(400).json({ code: 400, message: '用户名已存在' });
    }

    const user = await User.create({ username, password, real_name, role: 'supplier', phone, email, company_name });
    res.json({ code: 200, message: '供应商创建成功', data: user });
  } catch (err) {
    next(err);
  }
});

// 批量创建供应商（支持 JSON 数组或 CSV 文件上传）
router.post('/batch', require('multer')({ storage: require('multer').memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('file'), async (req, res, next) => {
  try {
    let suppliers;

    if (req.file) {
      const csvContent = req.file.buffer.toString('utf-8').replace(/^\uFEFF/, '');
      const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        return res.status(400).json({ code: 400, message: 'CSV文件至少需要包含表头和一行数据' });
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      suppliers = [];
      for (let i = 1; i < lines.length; i++) {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (const char of lines[i]) {
          if (char === '"') { inQuotes = !inQuotes; }
          else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
          else { current += char; }
        }
        values.push(current.trim());

        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx] || '';
        });

        suppliers.push({
          username: row.username || row['用户名'] || '',
          password: row.password || row['密码'] || '123456',
          real_name: row.real_name || row.name || row['姓名'] || '',
          phone: row.phone || row['电话'] || '',
          email: row.email || row['邮箱'] || '',
          company_name: row.company_name || row.company || row['公司'] || ''
        });
      }
    } else {
      suppliers = req.body.suppliers || req.body;
      if (!Array.isArray(suppliers)) {
        return res.status(400).json({ code: 400, message: '请提供供应商数组或上传CSV文件' });
      }
    }

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return res.status(400).json({ code: 400, message: '供应商数据不能为空' });
    }

    if (suppliers.length > 100) {
      return res.status(400).json({ code: 400, message: '单次批量创建不能超过100个' });
    }

    const fieldMap = { name: 'real_name', company: 'company_name' };
    suppliers = suppliers.map(s => normalizeFields(s, fieldMap));

    const results = await User.batchCreate(suppliers);
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({ code: 200, message: `批量创建完成：成功 ${success} 个，失败 ${failed} 个`, data: results });
  } catch (err) {
    next(err);
  }
});

// 更新供应商
router.put('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'supplier') {
      return res.status(404).json({ code: 404, message: '供应商不存在' });
    }

    const allowedFields = ['real_name', 'phone', 'email', 'company_name'];
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    });
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ code: 400, message: '没有要更新的字段' });
    }
    await User.update(req.params.id, updateData);
    res.json({ code: 200, message: '更新成功' });
  } catch (err) {
    next(err);
  }
});

// 重置供应商密码
router.put('/:id/reset-password', async (req, res, next) => {
  try {
    const { new_password } = req.body;
    const password = new_password || '123456';
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '新密码至少6位' });
    }

    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'supplier') {
      return res.status(404).json({ code: 404, message: '供应商不存在' });
    }

    await User.updatePassword(req.params.id, password);
    res.json({ code: 200, message: '密码已重置成功' });
  } catch (err) {
    next(err);
  }
});

// 启用/禁用供应商
router.put('/:id/toggle-status', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'supplier') {
      return res.status(404).json({ code: 404, message: '供应商不存在' });
    }

    const newStatus = user.status === 1 ? 0 : 1;
    await User.update(req.params.id, { status: newStatus });
    res.json({ code: 200, message: newStatus === 1 ? '供应商已启用' : '供应商已禁用' });
  } catch (err) {
    next(err);
  }
});

// 删除供应商
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'supplier') {
      return res.status(404).json({ code: 404, message: '供应商不存在' });
    }

    const { transaction } = require('../utils/transaction');
    await transaction(async (client) => {
      const bidIds = await client.query('SELECT id FROM bids WHERE supplier_id = $1', [req.params.id]);
      if (bidIds.rows.length > 0) {
        const ids = bidIds.rows.map(r => r.id);
        await client.query('DELETE FROM evaluations WHERE bid_id = ANY($1)', [ids]);
        await client.query('DELETE FROM clarification_responses WHERE request_id IN (SELECT id FROM clarification_requests WHERE bid_id = ANY($1))', [ids]);
        await client.query('DELETE FROM clarification_requests WHERE bid_id = ANY($1)', [ids]);
        await client.query('DELETE FROM bids WHERE supplier_id = $1', [req.params.id]);
      }
      await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    });

    res.json({ code: 200, message: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
