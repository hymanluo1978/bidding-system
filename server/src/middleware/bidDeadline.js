const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const { query } = require('../config/database');

async function checkBidDeadline(req, res, next) {
  const tenderId = req.body.tender_id || req.params.tenderId || req.query.tenderId || req.body.tenderId;
  if (!tenderId) return next();

  try {
    const result = await query('SELECT bid_deadline, status FROM tenders WHERE id = $1', [tenderId]);
    const tender = result.rows[0];

    if (!tender) {
      return res.status(404).json({ code: 404, message: '招标项目不存在' });
    }

    if (tender.status !== 'published' && tender.status !== 'bidding') {
      return res.status(400).json({ code: 400, message: '该招标项目当前不接受投标' });
    }

    if (tender.bid_deadline) {
      const now = dayjs.utc();
      const deadline = dayjs.utc(tender.bid_deadline);
      if (now.isAfter(deadline)) {
        return res.status(400).json({ code: 400, message: '投标截止时间已过，无法提交投标' });
      }
    }

    req.tender = tender;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { checkBidDeadline };
