import React, { useState, useEffect, useRef } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Card,
  Modal,
  Form,
  Upload,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import api from '../../services/api';

const { Option } = Select;

const statusMap = {
  1: { label: '正常', color: 'green' },
  0: { label: '已禁用', color: 'red' },
};

const SupplierList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, [page, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (keyword) params.keyword = keyword;
      if (statusFilter) params.status = statusFilter;

      const res = await api.get('/suppliers', { params });
      const result = res.data?.data || res.data || {};
      const list = result.list || result.items || result || [];
      setData(Array.isArray(list) ? list : []);
      setTotal(result.total || list.length);
    } catch (error) {
      console.error('获取供应商列表失败:', error);
      message.error('获取供应商列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/suppliers/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleResetPassword = async (id) => {
    try {
      await api.put(`/suppliers/${id}/reset-password`);
      message.success('密码已重置');
    } catch (error) {
      console.error('重置密码失败:', error);
      message.error('重置密码失败');
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    try {
      await api.put(`/suppliers/${id}/toggle-status`);
      message.success(newStatus === 1 ? '已启用' : '已禁用');
      fetchData();
    } catch (error) {
      console.error('操作失败:', error);
      message.error('操作失败');
    }
  };

  const handleExportCSV = async () => {
    try {
      const res = await api.get('/suppliers/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'suppliers.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  const handleBatchCreate = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/suppliers/batch', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('批量创建成功');
      fetchData();
    } catch (error) {
      console.error('批量创建失败:', error);
      message.error('批量创建失败');
    }
  };

  const openModal = (supplier = null) => {
    setEditingSupplier(supplier);
    if (supplier) {
      form.setFieldsValue({
        username: supplier.username,
        name: supplier.real_name,
        company: supplier.company_name,
        phone: supplier.phone,
        email: supplier.email,
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);

      if (editingSupplier) {
        const { password, name, company, ...rest } = values;
        await api.put(`/suppliers/${editingSupplier.id || editingSupplier._id}`, { ...rest, real_name: name, company_name: company });
        message.success('更新成功');
      } else {
        const { name, company, ...rest } = values;
        await api.post('/suppliers', { ...rest, real_name: name, company_name: company });
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      if (error.response) {
        message.error(error.response?.data?.message || '操作失败');
      }
    } finally {
      setSubmitLoading(false);
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
    },
    {
      title: '公司',
      dataIndex: 'company_name',
      key: 'company_name',
      ellipsis: true,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 200,
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status) => {
        const item = statusMap[status];
        return item ? <Tag color={item.color}>{item.label}</Tag> : status;
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 260,
      fixed: 'right',
      render: (_, record) => {
        const id = record.id || record._id;
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => openModal(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确定要重置该供应商的密码吗？"
              onConfirm={() => handleResetPassword(id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small">
                重置密码
              </Button>
            </Popconfirm>
            <Button
              type="link"
              size="small"
              onClick={() => handleToggleStatus(id, record.status)}
            >
              {record.status === 1 ? '禁用' : '启用'}
            </Button>
            <Popconfirm
              title="确定要删除该供应商吗？"
              onConfirm={() => handleDelete(id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
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
              placeholder="搜索用户名、姓名或公司"
              prefix={<SearchOutlined />}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onPressEnter={handleSearch}
              allowClear
              style={{ width: 260 }}
            />
            <Select
              placeholder="状态筛选"
              value={statusFilter || undefined}
              onChange={(val) => {
                setStatusFilter(val || '');
                setPage(1);
              }}
              allowClear
              style={{ width: 120 }}
            >
              <Option value="1">正常</Option>
              <Option value="0">已禁用</Option>
            </Select>
            <Button type="primary" onClick={handleSearch}>
              搜索
            </Button>
          </Space>
          <Space wrap>
            <Button icon={<PlusOutlined />} type="primary" onClick={() => openModal()}>
              新建供应商
            </Button>
            <Upload
              accept=".csv,.xlsx,.xls"
              showUploadList={false}
              beforeUpload={(file) => {
                handleBatchCreate(file);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />}>批量创建</Button>
            </Upload>
            <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
              导出CSV
            </Button>
          </Space>
        </Space>

        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          scroll={{ x: 1100 }}
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

      <Modal
        title={editingSupplier ? '编辑供应商' : '新建供应商'}
        open={modalVisible}
        onOk={handleModalSubmit}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        okText="确认"
        cancelText="取消"
        confirmLoading={submitLoading}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" disabled={!!editingSupplier} />
          </Form.Item>
          {!editingSupplier && (
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" />
          </Form.Item>
          <Form.Item
            label="公司名称"
            name="company"
            rules={[{ required: true, message: '请输入公司名称' }]}
          >
            <Input placeholder="请输入公司名称" />
          </Form.Item>
          <Form.Item
            label="电话"
            name="phone"
          >
            <Input placeholder="请输入电话号码" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SupplierList;
