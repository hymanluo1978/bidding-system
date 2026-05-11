import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const JudgeForm = () => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      fetchJudge();
    }
  }, [id]);

  const fetchJudge = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/judges/${id}`);
      const data = res.data?.data || res.data || {};
      form.setFieldsValue({
        username: data.username,
        name: data.real_name,
        specialty: data.specialty,
        title: data.title,
        phone: data.phone,
      });
    } catch (error) {
      console.error('获取评委信息失败:', error);
      message.error('获取评委信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        const { password, name, ...rest } = values;
        await api.put(`/judges/${id}`, { ...rest, real_name: name });
        message.success('更新成功');
      } else {
        const { name, ...rest } = values;
        await api.post('/judges', { ...rest, real_name: name });
        message.success('创建成功');
      }
      handleClose();
    } catch (error) {
      if (error.response) {
        message.error(error.response?.data?.message || '操作失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setVisible(false);
    navigate('/admin/judges');
  };

  return (
    <Modal
      title={isEdit ? '编辑评委' : '新建评委'}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleClose}
      okText="确认"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
      maskClosable={false}
      afterClose={() => navigate('/admin/judges')}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="用户名"
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="请输入用户名" disabled={isEdit} />
        </Form.Item>
        {!isEdit && (
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
  );
};

export default JudgeForm;
