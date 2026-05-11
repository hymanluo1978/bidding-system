import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const SupplierForm = () => {
  const [form] = Form.useForm();
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      fetchSupplier();
    }
  }, [id]);

  const fetchSupplier = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/suppliers/${id}`);
      const data = res.data?.data || res.data || {};
      setSupplier(data);
      form.setFieldsValue({
        username: data.username,
        name: data.real_name,
        company: data.company_name,
        phone: data.phone,
        email: data.email,
      });
    } catch (error) {
      console.error('获取供应商信息失败:', error);
      message.error('获取供应商信息失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (isEdit) {
        const { password, name, company, ...rest } = values;
        await api.put(`/suppliers/${id}`, { ...rest, real_name: name, company_name: company });
        message.success('更新成功');
      } else {
        const { name, company, ...rest } = values;
        await api.post('/suppliers', { ...rest, real_name: name, company_name: company });
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
    navigate('/admin/suppliers');
  };

  return (
    <Modal
      title={isEdit ? '编辑供应商' : '新建供应商'}
      open={visible}
      onOk={handleSubmit}
      onCancel={handleClose}
      okText="确认"
      cancelText="取消"
      confirmLoading={loading}
      destroyOnClose
      maskClosable={false}
      afterClose={() => navigate('/admin/suppliers')}
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
  );
};

export default SupplierForm;
