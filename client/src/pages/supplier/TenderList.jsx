import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Input,
  Button,
  Tag,
  Space,
  Modal,
  Descriptions,
  Typography,
  message,
  Spin,
} from 'antd';
import { SearchOutlined, EyeOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const { Title } = Typography;

// 与后端 Tender 状态一致
const statusMap = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '招标中', color: 'processing' },
  bidding: { label: '招标中', color: 'processing' },
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'success' },
  cancelled: { label: '已取消', color: 'error' },
};

const TenderList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tenders, setTenders] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentTender, setCurrentTender] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [bidStatusMap, setBidStatusMap] = useState({});

  const fetchTenders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tenders/my-tenders', {
        params: { keyword },
      });
      // 后端返回 { code: 200, data: { list: [...], total, page, pageSize } }
      const result = res.data?.data || res.data || {};
      const list = result.list || result.items || [];
      setTenders(Array.isArray(list) ? list : []);
    } catch (err) {
      message.error('获取招标公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [keyword]);

  const fetchBidStatuses = useCallback(async () => {
    try {
      const res = await api.get('/bids/my-bids');
      const bids = res.data?.data || res.data || [];
      const statusMap = {};
      (Array.isArray(bids) ? bids : []).forEach((bid) => {
        statusMap[bid.tender_id] = bid.status;
      });
      setBidStatusMap(statusMap);
    } catch (err) {
      // 静默处理
    }
  }, []);

  useEffect(() => {
    fetchTenders();
    fetchBidStatuses();
  }, [fetchTenders, fetchBidStatuses]);

  const handleSearch = () => {
    fetchTenders();
  };

  const handleViewDetail = async (record) => {
    setDetailVisible(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/tenders/${record.id}`);
      setCurrentTender(res.data?.data || res.data);
    } catch (err) {
      message.error('获取招标详情失败');
      setCurrentTender(record);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBid = (record) => {
    navigate(`/supplier/tenders/${record.id}/bid`);
  };

  const columns = [
    {
      title: '项目编号',
      dataIndex: 'project_number',
      key: 'project_number',
      width: 140,
      render: (val, record) => val || record.tenderNo || '-',
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '预算金额（元）',
      dataIndex: 'budget',
      key: 'budget',
      width: 150,
      align: 'right',
      render: (val) => (val != null ? `¥ ${Number(val).toLocaleString()}` : '-'),
    },
    {
      title: '截止时间',
      dataIndex: 'bid_deadline',
      key: 'bid_deadline',
      width: 180,
      render: (val) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const item = statusMap[status] || { label: status || '未知', color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => {
        const hasBid = !!bidStatusMap[record.id];
        const isClosed =
          record.status === 'completed' ||
          record.status === 'cancelled';

        return (
          <Space>
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            >
              查看详情
            </Button>
            {isClosed ? null : hasBid ? (
              <Button type="link" disabled>
                已投标
              </Button>
            ) : (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => handleBid(record)}
              >
                投标
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          招标公告列表
        </Title>

        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <Input
            placeholder="请输入关键词搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 300 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={tenders}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>

      <Modal
        title="招标详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={720}
      >
        <Spin spinning={detailLoading}>
          {currentTender && (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="项目编号" span={2}>
                {currentTender.project_number || currentTender.tenderNo || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="项目名称" span={2}>
                {currentTender.title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="限价金额">
                {currentTender.budget != null && Number(currentTender.budget) > 0
                  ? `¥ ${Number(currentTender.budget).toLocaleString()}`
                  : '不限价'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {(() => {
                  const item =
                    statusMap[currentTender.status] || {
                      label: currentTender.status || '未知',
                      color: 'default',
                    };
                  return <Tag color={item.color}>{item.label}</Tag>;
                })()}
              </Descriptions.Item>
              <Descriptions.Item label="投标截止时间">
                {currentTender.bid_deadline
                  ? new Date(currentTender.bid_deadline).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="开标时间">
                {currentTender.open_bid_date
                  ? new Date(currentTender.open_bid_date).toLocaleString('zh-CN')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="项目描述" span={2}>
                {currentTender.description || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="技术要求" span={2}>
                {currentTender.requirements || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="资质要求" span={2}>
                {currentTender.qualification_requirements || currentTender.qualificationRequirements || '-'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default TenderList;
