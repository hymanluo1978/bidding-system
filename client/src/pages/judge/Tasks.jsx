import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Tag,
  Empty,
} from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const { Title } = Typography;

const Tasks = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/evaluation/my-tasks');
      setTasks(res.data?.data || res.data || []);
    } catch (err) {
      message.error('获取评标任务列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleEnterScoring = (record) => {
    navigate(`/judge/tasks/${record.tender_id || record.id}`);
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
      title: '投标数',
      dataIndex: 'bidCount',
      key: 'bidCount',
      width: 100,
      align: 'center',
      render: (val) => val ?? 0,
    },
    {
      title: '已评分数',
      dataIndex: 'scoredCount',
      key: 'scoredCount',
      width: 100,
      align: 'center',
      render: (val, record) => {
        const scored = val ?? 0;
        const total = record.bidCount ?? 0;
        const allDone = total > 0 && scored >= total;
        return allDone ? (
          <Tag color="green">{scored} / {total}</Tag>
        ) : (
          <span>{scored} / {total}</span>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const map = {
          pending: { label: '待评标', color: 'warning' },
          in_progress: { label: '评标中', color: 'processing' },
          completed: { label: '已完成', color: 'success' },
        };
        const item = map[status] || { label: status || '未知', color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => {
        const isCompleted = record.status === 'completed';
        return (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => handleEnterScoring(record)}
            disabled={isCompleted}
          >
            {isCompleted ? '已完成' : '进入评标'}
          </Button>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          评标任务列表
        </Title>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : tasks.length === 0 ? (
          <Empty
            description="暂无评标任务"
            style={{ padding: 60 }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={tasks}
            rowKey={(record) => record.tender_id || record.id}
            pagination={false}
          />
        )}
      </Card>
    </div>
  );
};

export default Tasks;
