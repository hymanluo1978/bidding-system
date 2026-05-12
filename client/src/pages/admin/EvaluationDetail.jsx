import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  message,
  Divider,
  Popconfirm,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

const statusMap = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'blue' },
  bidding: { label: '招标中', color: 'orange' },
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'red' },
};

const EvaluationDetail = () => {
  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState(null);
  const [committee, setCommittee] = useState([]);
  const [results, setResults] = useState([]);
  const [winner, setWinner] = useState(null);
  const [weights, setWeights] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const navigate = useNavigate();
  const { tenderId: id } = useParams();

  useEffect(() => {
    if (id) {
      fetchAllData();
    }
  }, [id]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchTenderDetail(),
        fetchCommittee(),
        fetchResults(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenderDetail = async () => {
    try {
      const res = await api.get(`/tenders/${id}`);
      setTender(res.data?.data || res.data || null);
    } catch (error) {
      console.error('获取招标详情失败:', error);
    }
  };

  const fetchCommittee = async () => {
    try {
      const res = await api.get(`/evaluation/committee/${id}`);
      const data = res.data?.data || res.data || null;
      // 后端返回 { ...committee, judges: [...], judge_ids: [...] }
      if (data && data.judges) {
        setCommittee(Array.isArray(data.judges) ? data.judges : []);
      } else if (Array.isArray(data)) {
        setCommittee(data);
      } else {
        setCommittee([]);
      }
    } catch (error) {
      console.error('获取委员会成员失败:', error);
    }
  };

  const fetchResults = async () => {
    try {
      const res = await api.get(`/evaluation/result/${id}`);
      const data = res.data?.data || res.data || null;
      // 后端返回格式: { results: [...], winner: {...}, weights: {...} }
      if (data && data.results) {
        setResults(Array.isArray(data.results) ? data.results : []);
        setWinner(data.winner || null);
        setWeights(data.weights || null);
      } else if (Array.isArray(data)) {
        setResults(data);
        setWinner(null);
      } else {
        setResults([]);
        setWinner(null);
      }
    } catch (error) {
      console.error('获取评标结果失败:', error);
    }
  };

  const handleConfirmResult = async () => {
    // winner 来自后端 calculateResult 返回的 results[0]
    // 其中包含 bid.id (投标ID)
    if (!winner) {
      message.warning('暂无评标结果，请先完成评分');
      return;
    }
    const winnerBidId = winner.id;
    if (!winnerBidId) {
      message.warning('无法确定中标投标记录');
      return;
    }

    setConfirmLoading(true);
    try {
      await api.post(`/evaluation/confirm-result`, {
        tender_id: id,
        winner_bid_id: winnerBidId,
      });
      message.success('评标结果已确认，中标单位已设置');
      fetchAllData();
    } catch (error) {
      console.error('确认评标结果失败:', error);
      message.error(error.response?.data?.message || '确认评标结果失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const committeeColumns = [
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 120,
    },
    {
      title: '专业领域',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 150,
    },
    {
      title: '职称',
      dataIndex: 'title',
      key: 'title',
      width: 120,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 160,
    },
  ];

  // 评标结果列 - 字段名匹配后端 calculateResult 返回值
  const resultColumns = [
    {
      title: '排名',
      key: 'rank',
      width: 70,
      align: 'center',
      render: (_, __, index) => {
        if (index === 0) return <Tag color="gold">1 (中标)</Tag>;
        return index + 1;
      },
    },
    {
      title: '供应商',
      key: 'supplierName',
      render: (_, record) =>
        record.company_name || record.real_name || record.supplierName || '-',
    },
    {
      title: '报价（元）',
      key: 'price',
      width: 130,
      render: (_, record) => {
        const price = record.bid_price || record.price || record.amount || 0;
        return `¥${Number(price).toLocaleString()}`;
      },
    },
    {
      title: '技术均分',
      dataIndex: 'avg_technical',
      key: 'avg_technical',
      width: 100,
      align: 'center',
      render: (val) => (val != null ? Number(val).toFixed(1) : '-'),
    },
    {
      title: '商务均分',
      dataIndex: 'avg_business',
      key: 'avg_business',
      width: 100,
      align: 'center',
      render: (val) => (val != null ? Number(val).toFixed(1) : '-'),
    },
    {
      title: '价格均分',
      dataIndex: 'avg_price',
      key: 'avg_price',
      width: 100,
      align: 'center',
      render: (val) => (val != null ? Number(val).toFixed(1) : '-'),
    },
    {
      title: '加权总分',
      dataIndex: 'avg_total',
      key: 'avg_total',
      width: 110,
      align: 'center',
      render: (val) => (val != null ? Number(val).toFixed(2) : '-'),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Card
        title={
          <Space>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/admin/evaluation')}
            />
            <span>评标详情</span>
          </Space>
        }
        extra={
          <Space>
            <Popconfirm
              title="确认评标结果后，排名第一的供应商将成为中标单位。确定要确认吗？"
              onConfirm={handleConfirmResult}
              okText="确定确认"
              cancelText="取消"
            >
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={confirmLoading}
                disabled={tender?.status === 'completed'}
              >
                {tender?.status === 'completed' ? '评标已确认' : '确认评标结果'}
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        {/* 招标基本信息 */}
        <Title level={5}>招标基本信息</Title>
        <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="项目编号">
            {tender?.tenderNo || tender?.project_number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标题">
            {tender?.title || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预算金额">
            {tender?.budget != null
              ? `¥${Number(tender.budget).toLocaleString()}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {tender?.status ? (
              <Tag color={statusMap[tender.status]?.color}>
                {statusMap[tender.status]?.label || tender.status}
              </Tag>
            ) : '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* 评标委员会 */}
        <Title level={5}>评标委员会成员</Title>
        <Table
          columns={committeeColumns}
          dataSource={committee}
          rowKey={(record) => record.id || record._id}
          pagination={false}
          size="small"
          locale={{ emptyText: '尚未组建评标委员会' }}
          style={{ marginBottom: 24 }}
        />

        <Divider />

        {/* 评标结果 */}
        <Title level={5}>评标结果</Title>
        {weights && (
          <p style={{ color: '#888', marginBottom: 16 }}>
            权重配置：技术 {weights.technical}% / 商务 {weights.business}% / 价格 {weights.price}%
          </p>
        )}
        <Table
          columns={resultColumns}
          dataSource={results}
          rowKey={(record) => record.id || record._id || record.supplier_id}
          pagination={false}
          size="middle"
          locale={{ emptyText: '暂无评标结果' }}
        />
      </Card>
    </div>
  );
};

export default EvaluationDetail;
