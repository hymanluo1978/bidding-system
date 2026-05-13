import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Typography } from 'antd';
import {
  FileTextOutlined,
  SyncOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTenders: 0,
    ongoingTenders: 0,
    supplierCount: 0,
    judgeCount: 0,
  });
  const [recentTenders, setRecentTenders] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [tendersRes, suppliersRes, judgesRes] = await Promise.all([
        api.get('/tenders', { params: { page: 1, pageSize: 5 } }).catch(() => ({ data: { data: { list: [], total: 0 } } })),
        api.get('/suppliers', { params: { page: 1, pageSize: 1 } }).catch(() => ({ data: { data: { total: 0 } } })),
        api.get('/judges').catch(() => ({ data: { data: [] } })),
      ]);

      const tendersData = tendersRes.data?.data || tendersRes.data || {};
      const tendersList = tendersData.list || tendersData.items || tendersData || [];
      const tendersTotal = tendersData.total || tendersList.length;

      const suppliersData = suppliersRes.data?.data || suppliersRes.data || {};
      const supplierCount = suppliersData.total || 0;

      const judgesData = judgesRes.data?.data || judgesRes.data || [];
      const judgeCount = Array.isArray(judgesData)
        ? judgesData.length
        : judgesData.total || 0;

      const ongoingCount = Array.isArray(tendersList)
        ? tendersList.filter(
            (t) => t.status === 'published' || t.status === 'bidding' || t.status === 'evaluation'
          ).length
        : 0;

      setStats({
        totalTenders: tendersTotal,
        ongoingTenders: ongoingCount,
        supplierCount,
        judgeCount,
      });
      setRecentTenders(Array.isArray(tendersList) ? tendersList : []);
    } catch (error) {
      console.error('获取工作台数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '项目编号',
      dataIndex: 'tenderNo',
      key: 'tenderNo',
      width: 140,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '预算金额',
      dataIndex: 'budget',
      key: 'budget',
      width: 130,
      render: (val) => (val != null ? `¥${Number(val).toLocaleString()}` : '-'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const item = statusMap[status];
        return item ? <Tag color={item.color}>{item.label}</Tag> : status;
      },
    },
    {
      title: '投标数',
      dataIndex: 'bid_count',
      key: 'bid_count',
      width: 80,
      align: 'center',
      render: (val) => val ?? 0,
    },
    {
      title: '截止时间',
      dataIndex: 'bid_deadline',
      key: 'bid_deadline',
      width: 170,
      render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>
        工作台
      </Title>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="招标项目总数"
                value={stats.totalTenders}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="进行中项目"
                value={stats.ongoingTenders}
                prefix={<SyncOutlined spin />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="供应商数"
                value={stats.supplierCount}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="评委数"
                value={stats.judgeCount}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="最近招标项目">
          <Table
            columns={columns}
            dataSource={recentTenders}
            rowKey={(record) => record.id || record._id || record.tenderNo}
            pagination={false}
            size="middle"
            onRow={(record) => ({
              onClick: () => navigate(`/admin/tenders/${record.id || record._id}`),
              style: { cursor: 'pointer' },
            })}
          />
        </Card>
      </Spin>
    </div>
  );
};

export default Dashboard;
