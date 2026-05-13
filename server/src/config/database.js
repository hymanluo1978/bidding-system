/**
 * PostgreSQL 数据库初始化与连接管理
 * 使用 pg 驱动
 */

const { Pool } = require('pg');

// 从环境变量获取数据库连接字符串
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/bidding';

// 创建连接池
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// 监听连接错误
pool.on('error', (err) => {
  console.error('PostgreSQL 连接池错误:', err);
});

/**
 * 初始化数据库表结构
 */
async function initDatabase() {
  console.log('正在初始化 PostgreSQL 数据库...');

  const client = await pool.connect();
  try {
    await client.query(`
      -- ==================== 用户表 ====================
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        real_name VARCHAR(255) NOT NULL DEFAULT '',
        role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'manager', 'supplier', 'judge')),
        phone VARCHAR(50) DEFAULT '',
        email VARCHAR(255) DEFAULT '',
        company_name VARCHAR(255) DEFAULT '',
        status INTEGER NOT NULL DEFAULT 1 CHECK(status IN (0, 1)),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 招标项目表 ====================
      CREATE TABLE IF NOT EXISTS tenders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        project_number VARCHAR(255) NOT NULL UNIQUE,
        category VARCHAR(255) NOT NULL DEFAULT '',
        budget NUMERIC NOT NULL DEFAULT 0,
        description TEXT DEFAULT '',
        requirements TEXT DEFAULT '',
        qualification_requirements TEXT DEFAULT '',
        attachments JSONB DEFAULT '[]',
        status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'bidding', 'evaluation', 'completed', 'cancelled')),
        publish_date TIMESTAMP,
        bid_deadline TIMESTAMP,
        open_bid_date TIMESTAMP,
        creator_id UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 投标记录表 ====================
      CREATE TABLE IF NOT EXISTS bids (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tender_id UUID NOT NULL REFERENCES tenders(id),
        supplier_id UUID NOT NULL REFERENCES users(id),
        bid_price NUMERIC NOT NULL DEFAULT 0,
        technical_proposal TEXT DEFAULT '',
        business_proposal TEXT DEFAULT '',
        attachments JSONB DEFAULT '[]',
        status VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted', 'withdrawn', 'disqualified', 'won', 'lost')),
        submit_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tender_id, supplier_id)
      );

      -- ==================== 评委表 ====================
      CREATE TABLE IF NOT EXISTS judges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL UNIQUE REFERENCES users(id),
        specialty VARCHAR(500) DEFAULT '',
        title VARCHAR(255) DEFAULT '',
        phone VARCHAR(50) DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 评标委员会表 ====================
      CREATE TABLE IF NOT EXISTS evaluation_committees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tender_id UUID NOT NULL UNIQUE REFERENCES tenders(id),
        judge_ids JSONB NOT NULL DEFAULT '[]',
        leader_id UUID NOT NULL REFERENCES judges(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 评标记录表 ====================
      CREATE TABLE IF NOT EXISTS evaluations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tender_id UUID NOT NULL REFERENCES tenders(id),
        bid_id UUID NOT NULL REFERENCES bids(id),
        judge_id UUID NOT NULL REFERENCES judges(id),
        technical_score NUMERIC DEFAULT 0,
        business_score NUMERIC DEFAULT 0,
        price_score NUMERIC DEFAULT 0,
        total_score NUMERIC DEFAULT 0,
        comment TEXT DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(tender_id, bid_id, judge_id)
      );

      -- ==================== 公告通知表 ====================
      CREATE TABLE IF NOT EXISTS announcements (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tender_id UUID REFERENCES tenders(id),
        title VARCHAR(500) NOT NULL,
        content TEXT DEFAULT '',
        type VARCHAR(50) NOT NULL DEFAULT 'notice' CHECK(type IN ('notice', 'result', 'correction', 'cancel')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 评标权重配置表 ====================
      CREATE TABLE IF NOT EXISTS evaluation_weights (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tender_id UUID NOT NULL UNIQUE REFERENCES tenders(id),
        technical_weight NUMERIC NOT NULL DEFAULT 40,
        business_weight NUMERIC NOT NULL DEFAULT 30,
        price_weight NUMERIC NOT NULL DEFAULT 30,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 询标澄清表 ====================
      CREATE TABLE IF NOT EXISTS clarification_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tender_id UUID NOT NULL REFERENCES tenders(id),
        bid_id UUID NOT NULL REFERENCES bids(id),
        request_content TEXT NOT NULL,
        request_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'responded', 'closed')),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 澄清回复表 ====================
      CREATE TABLE IF NOT EXISTS clarification_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        request_id UUID NOT NULL REFERENCES clarification_requests(id),
        response_content TEXT NOT NULL,
        attachments JSONB DEFAULT '[]',
        response_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- ==================== 操作日志表 ====================
      CREATE TABLE IF NOT EXISTS operation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        target_type VARCHAR(255) DEFAULT '',
        target_id VARCHAR(255) DEFAULT '',
        detail TEXT DEFAULT '',
        ip VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 创建索引
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
      CREATE INDEX IF NOT EXISTS idx_tenders_creator ON tenders(creator_id);
      CREATE INDEX IF NOT EXISTS idx_bids_tender ON bids(tender_id);
      CREATE INDEX IF NOT EXISTS idx_bids_supplier ON bids(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_tender ON evaluations(tender_id);
      CREATE INDEX IF NOT EXISTS idx_evaluations_judge ON evaluations(judge_id);
      CREATE INDEX IF NOT EXISTS idx_logs_user ON operation_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);
    `);

    // 添加缺失的列（迁移）
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenders' AND column_name = 'attachments') THEN
          ALTER TABLE tenders ADD COLUMN attachments JSONB DEFAULT '[]';
        END IF;
      END $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_announcements_tender ON announcements(tender_id);
      CREATE INDEX IF NOT EXISTS idx_clarification_requests_tender ON clarification_requests(tender_id);
      CREATE INDEX IF NOT EXISTS idx_clarification_responses_request ON clarification_responses(request_id);
    `);

    console.log('PostgreSQL 数据库初始化完成');
  } finally {
    client.release();
  }
}

/**
 * 获取数据库连接池
 */
function getDb() {
  return pool;
}

/**
 * 执行 SQL 查询（兼容旧代码）
 */
async function query(text, params) {
  return pool.query(text, params);
}

module.exports = {
  initDatabase,
  getDb,
  query,
  pool
};
