const { test, describe } = require('node:test');
const assert = require('node:assert');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3001';
const isHTTPS = BASE_URL.startsWith('https');
const httpModule = isHTTPS ? https : require('http');

let adminToken = '';
let supplierToken = '';
let testTenderId = '';

function request(method, path, data, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || (isHTTPS ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = httpModule.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

describe('招投标系统 API 测试', { concurrency: 1 }, () => {

  describe('1. 认证模块', () => {
    test('管理员登录', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
      assert.ok(res.data.data.token, 'Token should exist');
      adminToken = res.data.data.token;
    });

    test('错误密码登录', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
      assert.equal(res.status, 401);
    });

    test('获取当前用户信息', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/auth/me', null, adminToken);
      assert.equal(res.status, 200);
      assert.ok(res.data.data.id);
    });

    test('会话校验', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/auth/session', null, adminToken);
      assert.equal(res.status, 200);
      assert.ok(res.data.data.role);
    });

    test('无token访问受保护路由', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/tenders');
      assert.equal(res.status, 401);
    });
  });

  describe('2. 招标模块', () => {
    test('获取统计数据', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/tenders/stats', null, adminToken);
      assert.equal(res.status, 200, `Stats failed: ${JSON.stringify(res.data)}`);
      assert.ok(typeof res.data.data.totalTenders === 'number');
    });

    test('获取招标列表', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/tenders', null, adminToken);
      assert.equal(res.status, 200);
      assert.ok(res.data.data.list);
    });

    test('创建招标项目', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/tenders', {
        title: '测试招标项目',
        project_number: 'TEST-' + Date.now(),
        category: 'engineering',
        budget: 100000,
        description: '测试描述',
        bid_deadline: '2026-12-31T23:59:59Z',
        open_bid_date: '2027-01-15T09:00:00Z'
      }, adminToken);
      assert.equal(res.status, 200, `Create tender failed: ${JSON.stringify(res.data)}`);
      testTenderId = res.data.data?.id;
      assert.ok(testTenderId, 'Tender ID should exist');
    });

    test('草稿状态不可变更为completed', { timeout: 60000 }, async () => {
      if (!testTenderId) return;
      const res = await request('PUT', `/api/tenders/${testTenderId}/status`, { status: 'completed' }, adminToken);
      assert.equal(res.status, 400);
    });

    test('发布招标', { timeout: 60000 }, async () => {
      if (!testTenderId) return;
      const res = await request('PUT', `/api/tenders/${testTenderId}/publish`, null, adminToken);
      assert.equal(res.status, 200, `Publish failed: ${JSON.stringify(res.data)}`);
    });

    test('已发布不可再编辑', { timeout: 60000 }, async () => {
      if (!testTenderId) return;
      const res = await request('PUT', `/api/tenders/${testTenderId}`, { title: '修改标题' }, adminToken);
      assert.equal(res.status, 400);
    });
  });

  describe('3. 评委模块', () => {
    test('获取评委列表', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/judges', null, adminToken);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data.data));
    });

    test('创建评委', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/judges', {
        username: 'judge_test_' + Date.now(),
        password: 'test123456',
        real_name: '测试评委',
        specialty: '工程技术',
        title: '高级工程师'
      }, adminToken);
      assert.equal(res.status, 200, `Create judge failed: ${JSON.stringify(res.data)}`);
    });
  });

  describe('4. 供应商模块', () => {
    test('获取供应商列表', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/suppliers', null, adminToken);
      assert.equal(res.status, 200);
    });

    test('创建供应商', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/suppliers', {
        username: 'supplier_test_' + Date.now(),
        password: 'test123456',
        real_name: '测试供应商',
        company_name: '测试公司'
      }, adminToken);
      assert.equal(res.status, 200, `Create supplier failed: ${JSON.stringify(res.data)}`);
    });

    test('导出CSV', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/suppliers/export', null, adminToken);
      assert.equal(res.status, 200);
    });
  });

  describe('5. 权重模块', () => {
    test('设置权重配置', { timeout: 60000 }, async () => {
      if (!testTenderId) return;
      const res = await request('PUT', `/api/weights/${testTenderId}`, {
        technical_weight: 40,
        business_weight: 30,
        price_weight: 30
      }, adminToken);
      assert.equal(res.status, 200);
    });

    test('权重和不等于100', { timeout: 60000 }, async () => {
      if (!testTenderId) return;
      const res = await request('PUT', `/api/weights/${testTenderId}`, {
        technical_weight: 50,
        business_weight: 30,
        price_weight: 30
      }, adminToken);
      assert.equal(res.status, 400);
    });
  });

  describe('6. 公告模块', () => {
    test('获取公告列表', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/announcements', null, adminToken);
      assert.equal(res.status, 200);
    });

    test('创建公告', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/announcements', {
        title: '测试公告',
        content: '测试内容',
        type: 'notice'
      }, adminToken);
      assert.equal(res.status, 200);
    });

    test('空标题创建公告', { timeout: 60000 }, async () => {
      const res = await request('POST', '/api/announcements', {
        title: '',
        content: '测试'
      }, adminToken);
      assert.equal(res.status, 400);
    });
  });

  describe('7. 操作日志模块', () => {
    test('获取日志列表', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/logs', null, adminToken);
      assert.equal(res.status, 200);
    });
  });

  describe('8. 用户管理模块', () => {
    test('获取用户列表', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/users', null, adminToken);
      assert.equal(res.status, 200);
    });
  });

  describe('9. 健康检查', () => {
    test('健康检查端点', { timeout: 60000 }, async () => {
      const res = await request('GET', '/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.data.code, 200);
    });
  });
});
