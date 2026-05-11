import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Descriptions,
  InputNumber,
  Input,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Divider,
  Tag,
  Empty,
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const ScoreForm = () => {
  const navigate = useNavigate();
  const { tenderId } = useParams();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [tenderInfo, setTenderInfo] = useState(null);
  const [bids, setBids] = useState([]);
  const [scores, setScores] = useState({});

  const fetchTaskData = useCallback(async () => {
    setLoading(true);
    try {
      // 并行获取招标详情和评标任务数据
      const [tenderRes, tasksRes] = await Promise.all([
        api.get(`/tenders/${tenderId}`).catch(() => ({ data: { data: null } })),
        api.get(`/evaluation/my-tasks/${tenderId}`),
      ]);

      // 招标详情
      const tenderData = tenderRes.data?.data || tenderRes.data || null;
      setTenderInfo(tenderData);

      // 评标任务数据：后端返回 [{ ...bid, has_scored, my_score }]
      const tasksData = tasksRes.data?.data || tasksRes.data || [];
      const bidsList = Array.isArray(tasksData) ? tasksData : [];
      setBids(bidsList);

      // 初始化已有评分
      const initScores = {};
      bidsList.forEach((bid) => {
        if (bid.my_score) {
          initScores[bid.id] = {
            technical_score: bid.my_score.technical_score,
            business_score: bid.my_score.business_score,
            price_score: bid.my_score.price_score,
            comment: bid.my_score.comment || '',
          };
        }
      });
      setScores(initScores);
    } catch (err) {
      console.error('获取评标任务数据失败:', err);
      message.error('获取评标任务数据失败');
    } finally {
      setLoading(false);
    }
  }, [tenderId]);

  useEffect(() => {
    fetchTaskData();
  }, [fetchTaskData]);

  const handleScoreChange = (bidId, field, value) => {
    setScores((prev) => ({
      ...prev,
      [bidId]: {
        ...(prev[bidId] || {}),
        [field]: value,
      },
    }));
  };

  const handleSave = async (bidId) => {
    const scoreData = scores[bidId] || {};

    if (
      scoreData.technical_score == null &&
      scoreData.business_score == null &&
      scoreData.price_score == null
    ) {
      message.warning('请至少填写一项评分后再保存');
      return;
    }

    const tScore = scoreData.technical_score;
    const bScore = scoreData.business_score;
    const pScore = scoreData.price_score;

    if ((tScore != null && (tScore < 0 || tScore > 100)) ||
        (bScore != null && (bScore < 0 || bScore > 100)) ||
        (pScore != null && (pScore < 0 || pScore > 100))) {
      message.error('评分必须在 0-100 之间');
      return;
    }

    setSaving((prev) => ({ ...prev, [bidId]: true }));

    try {
      await api.post('/evaluation/score', {
        tender_id: tenderId,
        bid_id: bidId,
        technical_score: tScore ?? null,
        business_score: bScore ?? null,
        price_score: pScore ?? null,
        comment: scoreData.comment || '',
      });

      message.success('评分保存成功');
      // 刷新数据以获取最新评分
      fetchTaskData();
    } catch (err) {
      message.error(err.response?.data?.message || '评分保存失败，请稍后重试');
    } finally {
      setSaving((prev) => ({ ...prev, [bidId]: false }));
    }
  };

  const getTotalScore = (bidId) => {
    const s = scores[bidId] || {};
    const tech = s.technical_score || 0;
    const comm = s.business_score || 0;
    const price = s.price_score || 0;
    return tech + comm + price;
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/judge/tasks')}
          >
            返回任务列表
          </Button>
        </Space>

        <Title level={4}>评标打分</Title>

        {/* 招标项目信息 */}
        {tenderInfo && (
          <Card
            type="inner"
            title="招标项目信息"
            style={{ marginBottom: 24 }}
            size="small"
          >
            <Descriptions bordered column={3} size="small">
              <Descriptions.Item label="项目编号">
                {tenderInfo.project_number || tenderInfo.tenderNo || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="项目名称">
                {tenderInfo.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="预算金额">
                {tenderInfo.budget != null
                  ? `¥ ${Number(tenderInfo.budget).toLocaleString()}`
                  : '-'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {/* 投标评分列表 */}
        <Card type="inner" title="投标评分">
          {bids.length === 0 ? (
            <Empty description="暂无投标记录" style={{ padding: 40 }} />
          ) : (
            bids.map((bid, index) => {
              const bidId = bid.id;
              const bidScores = scores[bidId] || {};
              const total = getTotalScore(bidId);
              const hasScore = bidScores.technical_score != null ||
                bidScores.business_score != null ||
                bidScores.price_score != null;

              return (
                <div key={bidId || index}>
                  {index > 0 && <Divider style={{ margin: '24px 0' }} />}

                  <div
                    style={{
                      background: '#fafafa',
                      padding: '16px 20px',
                      borderRadius: 8,
                      marginBottom: 16,
                    }}
                  >
                    <Space size="large" wrap>
                      <Text strong>投标 #{index + 1}</Text>
                      <Text>供应商：{bid.real_name || bid.company_name || '-'}</Text>
                      <Text>公司：{bid.company_name || '-'}</Text>
                      <Text>
                        报价金额：
                        {bid.bid_price != null
                          ? `¥ ${Number(bid.bid_price).toLocaleString()}`
                          : '-'}
                      </Text>
                      {bid.has_scored && (
                        <Tag color="green">
                          <CheckCircleOutlined /> 已评分
                        </Tag>
                      )}
                      {hasScore && (
                        <Tag color="blue">
                          当前总分：{total}
                        </Tag>
                      )}
                    </Space>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1fr',
                      gap: 16,
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        技术评分（0-100）
                      </Text>
                      <InputNumber
                        min={0}
                        max={100}
                        value={bidScores.technical_score}
                        onChange={(val) => handleScoreChange(bidId, 'technical_score', val)}
                        placeholder="请输入技术评分"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        商务评分（0-100）
                      </Text>
                      <InputNumber
                        min={0}
                        max={100}
                        value={bidScores.business_score}
                        onChange={(val) => handleScoreChange(bidId, 'business_score', val)}
                        placeholder="请输入商务评分"
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                        价格评分（0-100）
                      </Text>
                      <InputNumber
                        min={0}
                        max={100}
                        value={bidScores.price_score}
                        onChange={(val) => handleScoreChange(bidId, 'price_score', val)}
                        placeholder="请输入价格评分"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                      评语
                    </Text>
                    <TextArea
                      rows={3}
                      value={bidScores.comment}
                      onChange={(e) => handleScoreChange(bidId, 'comment', e.target.value)}
                      placeholder="请输入评语"
                      maxLength={1000}
                      showCount
                    />
                  </div>

                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={saving[bidId]}
                    onClick={() => handleSave(bidId)}
                  >
                    保存评分
                  </Button>
                </div>
              );
            })
          )}
        </Card>
      </Card>
    </div>
  );
};

export default ScoreForm;
