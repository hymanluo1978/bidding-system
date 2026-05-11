import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Popconfirm,
  message,
  Card,
  Modal,
  Form,
  Input,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../../services/api';

const JudgeList = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingJudge, setEditingJudge] = useState(null);
  const [form] = Form.useForm();
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/judges');
      const result = res.data?.data || res.data || {};
      const list = result.list || result.items || result || [];
      setData(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error('获取评委列表失败:', error);
      message.error('获取评委列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/judges/${id}`);
      message.success('删除成功');
      fetchData();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败');
    }
  };

  const handleResetPassword = async (id) => {
    try {
      await api.put(`/judges/${id}/reset-password`);
      message.success('密码已重置');
    } catch (error) {
      console.error('重置密码失败:', error);
      message.error('重置密码失败');
    }
  };

  const openModal = (judge = null) => {
    setEditingJudge(judge);
    if (judge) {
      form.setFieldsValue({
        username: judge.username,
        name: judge.real_name,
        specialty: judge.specialty,
        title: judge.title,
        phone: judge.phone,
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

      if (editingJudge) {
        const { password, name, ...rest } = values;
        await api.put(`/judges/${editingJudge.id || editingJudge._id}`, { ...rest, real_name: name });
        message.success('更新成功');
      } else {
        const { name, ...rest } = values;
        await api.post('/judges', { ...rest, real_name: name });
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
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 120,
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '专业领域',
      dataIndex: 'specialty',
      key: 'specialty',
      width: 150,
    },
    {
      title: '职称',
      dataIndex: 'title',
      key: 'title',
      width: 120,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_, record) => {
        const id = record.id || record._id;
        return (
          <Space size="small">
            <Button type="link" size="small" onClick={() => openModal(record)}>
              编辑
            </Button>
            <Popconfirm
              title="确定要重置该评委的密码吗？"
              onConfirm={() => handleResetPassword(id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small">
                重置密码
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确定要删除该评委吗？"
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
      <Card
        title="评委列表"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openModal()}
          >
            新建评委
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingJudge ? '编辑评委' : '新建评委'}
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
            <Input placeholder="请输入用户名" disabled={!!editingJudge} />
          </Form.Item>
          {!editingJudge && (
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
            label="专业领域"
            name="specialty"
          >
            <Input placeholder="请输入专业领域，如：建筑工程、信息技术" />
          </Form.Item>
          <Form.Item
            label="职称"
            name="title"
          >
            <Input placeholder="请输入职称，如：高级工程师" />
          </Form.Item>
          <Form.Item
            label="电话"
            name="phone"
          >
            <Input placeholder="请输入电话号码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default JudgeList;
