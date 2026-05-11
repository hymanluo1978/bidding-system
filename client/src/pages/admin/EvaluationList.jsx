import React, { useState, useEffect } from 'react';
import { Table, Button, Tag, Card, Space, message } from 'antd';
import { TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const statusMap = {
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
};

const EvaluationList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 分别查询 evaluation 和 completed 状态的招标
      const [evalRes, completedRes] = await Promise.all([
        api.get('/tenders', { params: { status: 'evaluation', pageSize: 100 } }).catch(() => null),
        api.get('/tenders', { params: { status: 'completed', pageSize: 100 } }).catch(() => null),
      ]);

      const extractList = (res) => {
        if (!res) return [];
        const result = res.data?.data || res.data || {};
        const list = result.list || result.items || [];
        return Array.isArray(list) ? list : [];
      };

      const combined = [...extractList(evalRes), ...extractList(completedRes)];
      // 按创建时间降序
      combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      setData(combined);
    } catch (error) {
      console.error('获取评标列表失败:', error);
      message.error('获取评标列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '项目编号',
      dataIndex: 'tenderNo',
      key: 'tenderNo',
      width: 160,
      render: (val, record) => val || record.project_number || '-',
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
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
      dataIndex: 'bidCount',
      key: 'bidCount',
      width: 80,
      align: 'center',
      render: (val) => val ?? 0,
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      fixed: 'right',
      render: (_, record) => {
        const id = record.id || record._id;
        return (
          <Space size="small">
            <Button
              type="link"
              size="small"
              icon={<TeamOutlined />}
              onClick={() => navigate(`/admin/tenders/${id}`)}
            >
              组建委员会
            </Button>
            <Button
              type="link"
              size="small"
              icon={<TrophyOutlined />}
              onClick={() => navigate(`/admin/evaluation/${id}`)}
            >
              查看评标结果
            </Button>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card title="评标管理">
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          scroll={{ x: 700 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>
    </div>
  );
};

export default EvaluationList;
