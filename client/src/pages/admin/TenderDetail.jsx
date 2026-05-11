import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Tabs,
  Table,
  Tag,
  Button,
  Space,
  Spin,
  message,
  Statistic,
  Row,
  Col,
  Modal,
} from 'antd';
import {
  CheckCircleOutlined,
  TeamOutlined,
  TrophyOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const statusMap = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'blue' },
  bidding: { label: '招标中', color: 'orange' },
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'red' },
};

// 与后端 bids.status 一致
const bidStatusMap = {
  submitted: { label: '已提交', color: 'blue' },
  withdrawn: { label: '已撤回', color: 'default' },
  disqualified: { label: '已废标', color: 'red' },
  won: { label: '已中标', color: 'green' },
  lost: { label: '未中标', color: 'orange' },
};

const TenderDetail = () => {
  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState(null);
  const [bids, setBids] = useState([]);
  const [committeeModalVisible, setCommitteeModalVisible] = useState(false);
  const [judges, setJudges] = useState([]);
  const [selectedJudges, setSelectedJudges] = useState([]);
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      fetchDetail();
      fetchBids();
    }
  }, [id]);

  const fetchDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tenders/${id}`);
      setTender(res.data?.data || res.data || null);
    } catch (error) {
      console.error('获取招标详情失败:', error);
      message.error('获取招标详情失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const res = await api.get(`/bids/tender/${id}`);
      const data = res.data?.data || res.data || [];
      setBids(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取投标列表失败:', error);
    }
  };

  const handlePublish = async () => {
    try {
      await api.put(`/tenders/${id}/publish`);
      message.success('发布成功');
      fetchDetail();
    } catch (error) {
      console.error('发布失败:', error);
      message.error(error.response?.data?.message || '发布失败');
    }
  };

  const fetchJudges = async () => {
    try {
      const res = await api.get('/judges');
      const data = res.data?.data || res.data || [];
      setJudges(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取评委列表失败:', error);
    }
  };

  const handleOpenCommitteeModal = async () => {
    await fetchJudges();
    setCommitteeModalVisible(true);
  };

  const handleFormCommittee = async () => {
    if (selectedJudges.length === 0) {
      message.warning('请选择评委');
      return;
    }
    try {
      await api.post(`/evaluation/committee`, {
        tender_id: id,
        judge_ids: selectedJudges,
        leader_id: selectedJudges[0] || null
      });
      message.success('评标委员会组建成功');
      setCommitteeModalVisible(false);
      setSelectedJudges([]);
      fetchDetail();
    } catch (error) {
      console.error('组建委员会失败:', error);
      message.error(error.response?.data?.message || '组建委员会失败');
    }
  };

  // 报价汇总（匹配后端 bid_price 字段）
  const priceStats = React.useMemo(() => {
    if (!bids.length) return { min: 0, max: 0, avg: 0, count: 0 };
    const prices = bids
      .map((b) => Number(b.bid_price || b.price || 0))
      .filter((p) => p > 0);
    if (!prices.length) return { min: 0, max: 0, avg: 0, count: 0 };
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      count: prices.length,
    };
  }, [bids]);

  const bidColumns = [
    {
      title: '供应商',
      key: 'supplierName',
      render: (_, record) => record.real_name || record.company_name || record.supplierName || '-',
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      key: 'company_name',
      render: (val) => val || '-',
    },
    {
      title: '报价（元）',
      dataIndex: 'bid_price',
      key: 'bid_price',
      render: (val) => {
        const price = val || 0;
        return `¥${Number(price).toLocaleString()}`;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const item = bidStatusMap[status];
        return item ? <Tag color={item.color}>{item.label}</Tag> : (status || '-');
      },
    },
    {
      title: '提交时间',
      dataIndex: 'submit_time',
      key: 'submit_time',
      render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ];

  const judgeColumns = [
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
    },
    {
      title: '专业领域',
      dataIndex: 'specialty',
      key: 'specialty',
    },
    {
      title: '职称',
      dataIndex: 'title',
      key: 'title',
    },
  ];

  const tabItems = [
    {
      key: 'basic',
      label: '基本信息',
      children: (
        <Descriptions bordered column={2}>
          <Descriptions.Item label="项目编号">
            {tender?.tenderNo || tender?.project_number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标题">{tender?.title || '-'}</Descriptions.Item>
          <Descriptions.Item label="分类">
            {tender?.category === 'engineering'
              ? '工程类'
              : tender?.category === 'goods'
              ? '货物类'
              : tender?.category === 'service'
              ? '服务类'
              : tender?.category || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="预算金额">
            {tender?.budget != null ? `¥${Number(tender.budget).toLocaleString()}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="投标截止时间">
            {tender?.bid_deadline ? dayjs(tender.bid_deadline).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="开标时间">
            {tender?.open_bid_date ? dayjs(tender.open_bid_date).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            {tender?.status ? (
              <Tag color={statusMap[tender.status]?.color}>
                {statusMap[tender.status]?.label || tender.status}
              </Tag>
            ) : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {tender?.created_at ? dayjs(tender.created_at).format('YYYY-MM-DD HH:mm') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="描述" span={2}>
            {tender?.description || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="资质要求" span={2}>
            {tender?.qualification_requirements || '-'}
          </Descriptions.Item>
        </Descriptions>
      ),
    },
    {
      key: 'bids',
      label: '投标列表',
      children: (
        <Table
          columns={bidColumns}
          dataSource={bids}
          rowKey={(record) => record.id || record._id}
          pagination={false}
          size="middle"
          locale={{ emptyText: '暂无投标记录' }}
        />
      ),
    },
    {
      key: 'summary',
      label: '报价汇总',
      children: (
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic title="最低报价" value={priceStats.min} prefix="¥" precision={2} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="最高报价" value={priceStats.max} prefix="¥" precision={2} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="平均报价" value={priceStats.avg} prefix="¥" precision={2} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="投标数量" value={priceStats.count} suffix="家" />
            </Card>
          </Col>
        </Row>
      ),
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
              onClick={() => navigate('/admin/tenders')}
            />
            <span>招标详情</span>
          </Space>
        }
        extra={
          <Space>
            {tender?.status === 'draft' && (
              <Button type="primary" icon={<CheckCircleOutlined />} onClick={handlePublish}>
                发布
              </Button>
            )}
            {(tender?.status === 'bidding' || tender?.status === 'published') && (
              <Button icon={<TeamOutlined />} onClick={handleOpenCommitteeModal}>
                组建评标委员会
              </Button>
            )}
            {(tender?.status === 'evaluation' || tender?.status === 'completed') && (
              <Button
                icon={<TrophyOutlined />}
                onClick={() => navigate(`/admin/evaluation/${id}`)}
              >
                查看评标结果
              </Button>
            )}
          </Space>
        }
      >
        <Tabs items={tabItems} />
      </Card>

      <Modal
        title="组建评标委员会"
        open={committeeModalVisible}
        onOk={handleFormCommittee}
        onCancel={() => {
          setCommitteeModalVisible(false);
          setSelectedJudges([]);
        }}
        okText="确认组建"
        cancelText="取消"
        width={600}
      >
        <Table
          columns={judgeColumns}
          dataSource={judges}
          rowKey={(record) => record.id || record._id}
          size="small"
          rowSelection={{
            selectedRowKeys: selectedJudges,
            onChange: (keys) => setSelectedJudges(keys),
          }}
          pagination={false}
        />
      </Modal>
    </div>
  );
};

export default TenderDetail;
