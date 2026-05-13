import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import { RollbackOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const { Title } = Typography;

const bidStatusMap = {
  submitted: { label: '已提交', color: 'blue' },
  withdrawn: { label: '已撤回', color: 'default' },
  disqualified: { label: '已废标', color: 'red' },
  won: { label: '已中标', color: 'green' },
  lost: { label: '未中标', color: 'orange' },
};

const MyBids = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [bids, setBids] = useState([]);

  const fetchMyBids = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/bids/my-bids');
      setBids(res.data?.data || res.data || []);
    } catch (err) {
      message.error('获取我的投标列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyBids();
  }, [fetchMyBids]);

  const handleWithdraw = async (record) => {
    try {
      await api.put(`/bids/${record.id}/withdraw`, { tender_id: record.tender_id });
      message.success('投标已撤回');
      fetchMyBids();
    } catch (err) {
      const errMsg =
        err.response?.data?.message || '撤回失败，请稍后重试';
      message.error(errMsg);
    }
  };

  const isDeadlinePassed = (deadline) => {
    if (!deadline) return true;
    return new Date(deadline) < new Date();
  };

  const columns = [
    {
      title: '项目编号',
      dataIndex: 'project_number',
      key: 'project_number',
      width: 140,
    },
    {
      title: '招标标题',
      dataIndex: 'tender_title',
      key: 'tender_title',
      ellipsis: true,
    },
    {
      title: '报价金额（元）',
      dataIndex: 'bid_price',
      key: 'bid_price',
      width: 150,
      align: 'right',
      render: (val) => (val != null ? `¥ ${Number(val).toLocaleString()}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const item = bidStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (val) => (val ? new Date(val).toLocaleString('zh-CN') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (record.status !== 'submitted') return null;
        if (isDeadlinePassed(record.bid_deadline)) {
          return (
            <Button type="link" disabled>
              已截止
            </Button>
          );
        }
        return (
          <Popconfirm
            title="确认撤回"
            description="确定要撤回该投标吗？撤回后不可恢复。"
            onConfirm={() => handleWithdraw(record)}
            okText="确认"
            cancelText="取消"
          >
            <Button type="link" danger icon={<RollbackOutlined />}>
              撤回投标
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          我的投标
        </Title>

        <Table
          columns={columns}
          dataSource={bids}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
        />
      </Card>
    </div>
  );
};

export default MyBids;
