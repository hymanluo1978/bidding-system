import React, { useState, useEffect } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, Tag, message, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { TextArea } = Input;
const { Option } = Select;

const typeMap = {
  notice: { label: '通知', color: 'blue' },
  result: { label: '结果公示', color: 'green' },
  correction: { label: '更正', color: 'orange' },
  cancel: { label: '取消', color: 'red' },
};

export default function AnnouncementList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => { fetchData(); }, [page, pageSize]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements', { params: { page, pageSize } });
      const result = res.data?.data || {};
      setData(result.list || []);
      setTotal(result.total || 0);
    } catch (error) {
      message.error('获取公告列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      form.setFieldsValue({ title: item.title, content: item.content, type: item.type, tender_id: item.tender_id });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitLoading(true);
      if (editingItem) {
        await api.put(`/announcements/${editingItem.id}`, values);
        message.success('更新成功');
      } else {
        await api.post('/announcements', values);
        message.success('创建成功');
      }
      setModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (error) {
      if (error.response) message.error(error.response?.data?.message || '操作失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/announcements/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100, render: (type) => { const item = typeMap[type]; return item ? <Tag color={item.color}>{item.label}</Tag> : type; } },
    { title: '关联招标', dataIndex: 'tender_title', key: 'tender_title', ellipsis: true, render: (v) => v || '-' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170, render: (v) => v ? new Date(v).toLocaleString('zh-CN') : '-' },
    {
      title: '操作', key: 'action', width: 150, render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openModal(record)}>编辑</Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => { Modal.confirm({ title: '确定删除此公告？', onOk: () => handleDelete(record.id) }); }}>删除</Button>
        </Space>
      )
    }
  ];

  return (
    <Card>
      <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }} wrap>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>发布公告</Button>
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, pageSize, total, showSizeChanger: true, showTotal: (t) => `共 ${t} 条`, onChange: (p, ps) => { setPage(p); setPageSize(ps); } }} />
      <Modal title={editingItem ? '编辑公告' : '发布公告'} open={modalVisible} onOk={handleSubmit}
        onCancel={() => { setModalVisible(false); form.resetFields(); }} confirmLoading={submitLoading} okText="确认" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: '请输入公告标题' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item label="类型" name="type" initialValue="notice">
            <Select>
              <Option value="notice">通知</Option>
              <Option value="result">结果公示</Option>
              <Option value="correction">更正</Option>
              <Option value="cancel">取消</Option>
            </Select>
          </Form.Item>
          <Form.Item label="关联招标项目ID" name="tender_id">
            <Input placeholder="可选，输入招标项目UUID" />
          </Form.Item>
          <Form.Item label="内容" name="content">
            <TextArea rows={6} placeholder="请输入公告内容" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
