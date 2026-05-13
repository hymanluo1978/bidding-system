import React, { useState, useEffect } from 'react';
import { Table, Input, Select, Space, Card, DatePicker } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;

export default function OperationLogs() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [action, setAction] = useState('');
  const [targetType, setTargetType] = useState('');
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (action) params.action = action;
      if (targetType) params.target_type = targetType;
      if (dateRange && dateRange[0]) params.start_date = dateRange[0].format('YYYY-MM-DD');
      if (dateRange && dateRange[1]) params.end_date = dateRange[1].format('YYYY-MM-DD');

      const res = await api.get('/logs', { params });
      const result = res.data?.data || {};
      setData(result.list || []);
      setTotal(result.total || 0);
    } catch (error) {
      console.error('获取日志失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: (v) => v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-' },
    { title: '操作人', key: 'operator', width: 120, render: (_, r) => r.real_name || r.username || '-' },
    { title: '操作', dataIndex: 'action', key: 'action', width: 200, ellipsis: true },
    { title: '目标类型', dataIndex: 'target_type', key: 'target_type', width: 120, render: (v) => v || '-' },
    { title: '目标ID', dataIndex: 'target_id', key: 'target_id', width: 120, ellipsis: true, render: (v) => v || '-' },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true, render: (v) => v || '-' },
    { title: 'IP', dataIndex: 'ip', key: 'ip', width: 130, render: (v) => v || '-' },
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Space wrap>
          <Input placeholder="操作关键词" prefix={<SearchOutlined />} value={action} onChange={(e) => setAction(e.target.value)} onPressEnter={handleSearch} allowClear style={{ width: 200 }} />
          <Select placeholder="目标类型" value={targetType || undefined} onChange={(v) => setTargetType(v || '')} allowClear style={{ width: 140 }}>
            <Option value="tender">招标</Option>
            <Option value="bid">投标</Option>
            <Option value="user">用户</Option>
            <Option value="evaluation">评标</Option>
          </Select>
          <RangePicker value={dateRange} onChange={setDateRange} />
          <button type="button" className="ant-btn ant-btn-primary" onClick={handleSearch}>搜索</button>
        </Space>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }} />
    </Card>
  );
}
