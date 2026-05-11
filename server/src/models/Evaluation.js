const { query } = require('../config/database');

class Evaluation {
  // 评委提交评分（创建或更新）
  static async createOrUpdate({ tender_id, bid_id, judge_id, technical_score = 0, business_score = 0, price_score = 0, total_score = 0, comment = '' }) {
    const existing = await query(
      'SELECT id FROM evaluations WHERE tender_id = $1 AND bid_id = $2 AND judge_id = $3',
      [tender_id, bid_id, judge_id]
    );

    if (existing.rows.length > 0) {
      await query(`
        UPDATE evaluations SET
          technical_score = $1, business_score = $2, price_score = $3,
          total_score = $4, comment = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
      `, [technical_score, business_score, price_score, total_score, comment, existing.rows[0].id]);
      return existing.rows[0].id;
    } else {
      const result = await query(`
        INSERT INTO evaluations (tender_id, bid_id, judge_id, technical_score, business_score, price_score, total_score, comment)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `, [tender_id, bid_id, judge_id, technical_score, business_score, price_score, total_score, comment]);
      return result.rows[0].id;
    }
  }

  // 获取招标项目的所有评标记录
  static async findByTenderId(tenderId) {
    const result = await query(`
      SELECT e.*, u.real_name as judge_name
      FROM evaluations e
      LEFT JOIN judges j ON e.judge_id = j.id
      LEFT JOIN users u ON j.user_id = u.id
      WHERE e.tender_id = $1
      ORDER BY e.bid_id, e.judge_id
    `, [tenderId]);
    return result.rows;
  }

  // 获取某个评委在某个招标项目的评分
  static async findByTenderAndJudge(tenderId, judgeId) {
    const result = await query(`
      SELECT e.*, b.bid_price, u.company_name, u.real_name as supplier_name
      FROM evaluations e
      LEFT JOIN bids b ON e.bid_id = b.id
      LEFT JOIN users u ON b.supplier_id = u.id
      WHERE e.tender_id = $1 AND e.judge_id = $2
    `, [tenderId, judgeId]);
    return result.rows;
  }

  // 计算评标结果（加权平均分）
  static async calculateResult(tenderId, weights = { technical: 40, business: 30, price: 30 }) {
    // 获取所有已提交的投标
    const bidsResult = await query(`
      SELECT b.id, b.supplier_id, b.bid_price, u.company_name, u.real_name
      FROM bids b
      LEFT JOIN users u ON b.supplier_id = u.id
      WHERE b.tender_id = $1 AND b.status = 'submitted'
    `, [tenderId]);

    const bids = bidsResult.rows;
    if (bids.length === 0) return { results: [], winner: null, weights };

    // 获取所有评分
    const evalsResult = await query('SELECT * FROM evaluations WHERE tender_id = $1', [tenderId]);
    const evaluations = evalsResult.rows;

    // 计算每个投标的加权平均分
    const results = bids.map(bid => {
      const bidEvals = evaluations.filter(e => e.bid_id === bid.id);

      if (bidEvals.length === 0) {
        return {
          ...bid,
          avg_technical: 0,
          avg_business: 0,
          avg_price: 0,
          avg_total: 0,
          eval_count: 0
        };
      }

      const avgTechnical = bidEvals.reduce((sum, e) => sum + (parseFloat(e.technical_score) || 0), 0) / bidEvals.length;
      const avgBusiness = bidEvals.reduce((sum, e) => sum + (parseFloat(e.business_score) || 0), 0) / bidEvals.length;
      const avgPrice = bidEvals.reduce((sum, e) => sum + (parseFloat(e.price_score) || 0), 0) / bidEvals.length;
      const avgTotal = (avgTechnical * weights.technical + avgBusiness * weights.business + avgPrice * weights.price) / 100;

      return {
        ...bid,
        avg_technical: parseFloat(avgTechnical.toFixed(2)),
        avg_business: parseFloat(avgBusiness.toFixed(2)),
        avg_price: parseFloat(avgPrice.toFixed(2)),
        avg_total: parseFloat(avgTotal.toFixed(2)),
        eval_count: bidEvals.length
      };
    });

    // 按总分降序排列
    results.sort((a, b) => (parseFloat(b.avg_total) || 0) - (parseFloat(a.avg_total) || 0));

    return {
      results,
      winner: results[0] || null,
      weights
    };
  }
}

module.exports = Evaluation;
