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
  Modal,
  Form,
  InputNumber,
  List,
  Input,
} from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  SettingOutlined,
  PaperClipOutlined,
  DownloadOutlined,
  QuestionCircleOutlined,
  PlusOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api, { getFileUrl } from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const statusMap = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'blue' },
  bidding: { label: '招标中', color: 'orange' },
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'red' },
};

const clarificationStatusMap = {
  pending: { label: '待回复', color: 'orange' },
  responded: { label: '已回复', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
};

const EvaluationDetail = () => {
  const [loading, setLoading] = useState(true);
  const [tender, setTender] = useState(null);
  const [committee, setCommittee] = useState([]);
  const [results, setResults] = useState([]);
  const [winner, setWinner] = useState(null);
  const [weights, setWeights] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [weightModalVisible, setWeightModalVisible] = useState(false);
  const [weightForm] = Form.useForm();
  const [savingWeight, setSavingWeight] = useState(false);
  const [bids, setBids] = useState([]);
  const [selectedBid, setSelectedBid] = useState(null);
  const [bidDetailVisible, setBidDetailVisible] = useState(false);
  const [clarifications, setClarifications] = useState([]);
  const [clarificationModalVisible, setClarificationModalVisible] = useState(false);
  const [newClarification, setNewClarification] = useState('');
  const [selectedBidForClarify, setSelectedBidForClarify] = useState(null);
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
        fetchBids(),
        fetchClarifications(),
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

  const fetchBids = async () => {
    try {
      const res = await api.get(`/bids/tender/${id}`);
      const data = res.data?.data || res.data || [];
      setBids(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取投标列表失败:', error);
    }
  };

  const fetchClarifications = async () => {
    try {
      const res = await api.get(`/clarifications/tender/${id}`);
      const data = res.data?.data || res.data || [];
      setClarifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('获取询标澄清列表失败:', error);
    }
  };

  const handleConfirmResult = async () => {
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

  const handleOpenWeightModal = async () => {
    try {
      const res = await api.get(`/weights/${id}`);
      const data = res.data?.data || {};
      weightForm.setFieldsValue({
        technical_weight: data.technical_weight || 40,
        business_weight: data.business_weight || 30,
        price_weight: data.price_weight || 30,
      });
      setWeightModalVisible(true);
    } catch (error) {
      weightForm.setFieldsValue({
        technical_weight: 40,
        business_weight: 30,
        price_weight: 30,
      });
      setWeightModalVisible(true);
    }
  };

  const handleSaveWeight = async () => {
    try {
      const values = await weightForm.validateFields();
      const total = (values.technical_weight || 0) + (values.business_weight || 0) + (values.price_weight || 0);
      if (total !== 100) {
        message.error('三个权重之和必须等于100%');
        return;
      }
      setSavingWeight(true);
      await api.put(`/weights/${id}`, {
        technical_weight: values.technical_weight,
        business_weight: values.business_weight,
        price_weight: values.price_weight,
      });
      message.success('权重配置已保存');
      setWeightModalVisible(false);
      fetchResults();
    } catch (error) {
      message.error(error.response?.data?.message || '保存失败');
    } finally {
      setSavingWeight(false);
    }
  };

  const handleViewBidDetail = (bid) => {
    setSelectedBid(bid);
    setBidDetailVisible(true);
  };

  const handleOpenClarification = (bid) => {
    setSelectedBidForClarify(bid);
    setClarificationModalVisible(true);
  };

  const handleSubmitClarification = async () => {
    if (!newClarification.trim()) {
      message.warning('请输入询标内容');
      return;
    }
    try {
      await api.post('/clarifications', {
        tender_id: id,
        bid_id: selectedBidForClarify.id,
        request_content: newClarification,
      });
      message.success('询标请求已提交');
      setClarificationModalVisible(false);
      setNewClarification('');
      setSelectedBidForClarify(null);
      fetchClarifications();
    } catch (error) {
      message.error(error.response?.data?.message || '提交失败');
    }
  };

  const committeeColumns = [
    { title: '姓名', dataIndex: 'real_name', key: 'real_name', width: 120 },
    { title: '专业领域', dataIndex: 'specialty', key: 'specialty', width: 150 },
    { title: '职称', dataIndex: 'title', key: 'title', width: 120 },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 160 },
  ];

  const bidColumns = [
    {
      title: '供应商',
      key: 'supplierName',
      render: (_, record) => record.real_name || record.company_name || '-',
    },
    {
      title: '报价（元）',
      dataIndex: 'bid_price',
      key: 'bid_price',
      width: 130,
      render: (val) => (val != null ? `¥${Number(val).toLocaleString()}` : '-'),
    },
    {
      title: '附件',
      key: 'attachments',
      width: 100,
      render: (_, record) => {
        const attachments = record.attachments || [];
        return attachments.length > 0 ? (
          <Tag color="blue"><PaperClipOutlined /> {attachments.length}个</Tag>
        ) : (
          <span style={{ color: '#999' }}>无</span>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewBidDetail(record)}>
            查看详情
          </Button>
          {tender?.status !== 'completed' && (
            <Button type="link" size="small" icon={<QuestionCircleOutlined />} onClick={() => handleOpenClarification(record)}>
              询标
            </Button>
          )}
        </Space>
      ),
    },
  ];

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

  const clarificationColumns = [
    {
      title: '供应商',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
      width: 150,
    },
    {
      title: '询标内容',
      dataIndex: 'request_content',
      key: 'request_content',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const item = clarificationStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 170,
      render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
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
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/evaluation')} />
            <span>评标详情</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<SettingOutlined />} onClick={handleOpenWeightModal}>
              权重配置
            </Button>
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
        <Title level={5}>招标基本信息</Title>
        <Descriptions bordered column={2} style={{ marginBottom: 24 }}>
          <Descriptions.Item label="项目编号">
            {tender?.tenderNo || tender?.project_number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="标题">{tender?.title || '-'}</Descriptions.Item>
          <Descriptions.Item label="限价金额">
            {tender?.budget != null && Number(tender.budget) > 0
              ? `¥${Number(tender.budget).toLocaleString()}`
              : '不限价'}
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

        <Title level={5}>投标列表（含附件查阅）</Title>
        <Table
          columns={bidColumns}
          dataSource={bids}
          rowKey={(record) => record.id || record._id}
          pagination={false}
          size="middle"
          locale={{ emptyText: '暂无投标记录' }}
          style={{ marginBottom: 24 }}
        />

        <Divider />

        <Title level={5}>询标澄清记录</Title>
        <Table
          columns={clarificationColumns}
          dataSource={clarifications}
          rowKey={(record) => record.id || record._id}
          pagination={false}
          size="small"
          locale={{ emptyText: '暂无询标记录' }}
          style={{ marginBottom: 24 }}
        />

        <Divider />

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

      <Modal
        title="权重配置"
        open={weightModalVisible}
        onOk={handleSaveWeight}
        onCancel={() => setWeightModalVisible(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={savingWeight}
      >
        <Form form={weightForm} layout="vertical">
          <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
            三个权重之和必须等于100%
          </Text>
          <Space size="large">
            <Form.Item name="technical_weight" label="技术权重 (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="business_weight" label="商务权重 (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="price_weight" label="价格权重 (%)" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} style={{ width: 100 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal
        title="投标详情"
        open={bidDetailVisible}
        onCancel={() => setBidDetailVisible(false)}
        footer={null}
        width={700}
      >
        {selectedBid && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="供应商">{selectedBid.real_name || selectedBid.company_name || '-'}</Descriptions.Item>
              <Descriptions.Item label="报价">¥{Number(selectedBid.bid_price || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="提交时间">
                {selectedBid.submit_time ? dayjs(selectedBid.submit_time).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag>{selectedBid.status === 'submitted' ? '已提交' : selectedBid.status}</Tag>
              </Descriptions.Item>
            </Descriptions>

            {selectedBid.technical_proposal && (
              <>
                <Divider orientation="left">技术方案</Divider>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedBid.technical_proposal}</div>
              </>
            )}

            {selectedBid.business_proposal && (
              <>
                <Divider orientation="left">商务方案</Divider>
                <div style={{ whiteSpace: 'pre-wrap' }}>{selectedBid.business_proposal}</div>
              </>
            )}

            {selectedBid.attachments && selectedBid.attachments.length > 0 && (
              <>
                <Divider orientation="left">附件</Divider>
                <List
                  size="small"
                  dataSource={selectedBid.attachments}
                  renderItem={(file) => (
                    <List.Item>
                      <Space>
                        <PaperClipOutlined />
                        <span>{file.name}</span>
                        <span style={{ color: '#999', fontSize: 12 }}>
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          href={getFileUrl(file.path)}
                          target="_blank"
                        >
                          下载
                        </Button>
                      </Space>
                    </List.Item>
                  )}
                />
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="提交询标请求"
        open={clarificationModalVisible}
        onOk={handleSubmitClarification}
        onCancel={() => {
          setClarificationModalVisible(false);
          setNewClarification('');
          setSelectedBidForClarify(null);
        }}
        okText="提交"
        cancelText="取消"
      >
        {selectedBidForClarify && (
          <div>
            <p style={{ marginBottom: 16 }}>
              向供应商 <strong>{selectedBidForClarify.real_name || selectedBidForClarify.company_name}</strong> 提交询标：
            </p>
            <TextArea
              rows={4}
              value={newClarification}
              onChange={(e) => setNewClarification(e.target.value)}
              placeholder="请输入需要澄清的内容..."
              maxLength={1000}
              showCount
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EvaluationDetail;
