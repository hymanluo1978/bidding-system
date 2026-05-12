import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Space, Tag, Popconfirm, message, Card } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;

const statusMap = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '已发布', color: 'blue' },
  bidding: { label: '招标中', color: 'orange' },
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'red' },
};

const TenderList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/tenders', { params });
      const result = res.data?.data || res.data || {};
      const list = result.list || result.items || result || [];
      setData(Array.isArray(list) ? list : []);
      setTotal(result.total || list.length);
    } catch (error) {
      console.error('获取招标列表失败:', error);
      message.error('获取招标列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const handleStatusChange = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  useEffect(() => {
    if (statusFilter !== undefined) {
      fetchData();
    }
  }, [statusFilter]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/tenders/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handlePublish = async (id) => {
    try {
      await api.put(`/tenders/${id}/publish`);
      message.success('发布成功');
      fetchData();
    } catch (error) {
      console.error('发布失败:', error);
      message.error('发布失败');
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
      title: '限价金额',
      dataIndex: 'budget',
      key: 'budget',
      width: 130,
      render: (val) => (val != null && Number(val) > 0 ? `¥${Number(val).toLocaleString()}` : '不限价'),
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
      title: '截止时间',
      dataIndex: 'bidDeadline',
      key: 'bidDeadline',
      width: 170,
      render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
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
              onClick={() => navigate(`/admin/tenders/${id}`)}
            >
              查看
            </Button>
            <Button
              type="link"
              size="small"
              onClick={() => navigate(`/admin/tenders/${id}/edit`)}
              disabled={record.status !== 'draft'}
            >
              编辑
            </Button>
            {record.status === 'draft' && (
              <Button
                type="link"
                size="small"
                onClick={() => handlePublish(id)}
              >
                发布
              </Button>
            )}
            {record.status === 'draft' && (
              <Popconfirm
                title="确定要删除该招标项目吗？"
                onConfirm={() => handleDelete(id)}
                okText="确定"
                cancelText="取消"
              >
                <Button type="link" size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
          <Space wrap>
            <Input
              placeholder="搜索项目编号或标题"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ width: 240 }}
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter || undefined}
              onChange={handleStatusChange}
              allowClear
              style={{ width: 140 }}
            >
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
              <Option value="bidding">招标中</Option>
              <Option value="evaluation">评标中</Option>
              <Option value="completed">已完成</Option>
              <Option value="cancelled">已取消</Option>
            </Select>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/admin/tenders/new')}
          >
            新建招标
          </Button>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          scroll={{ x: 1000 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
        />
      </Card>
    </div>
  );
};

export default TenderList;
