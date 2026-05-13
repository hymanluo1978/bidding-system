import React, { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Select, Button, Card, Space, message, DatePicker, Upload, Divider, List, Popconfirm } from 'antd';
import { UploadOutlined, DeleteOutlined, PaperClipOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

const TenderForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  useEffect(() => {
    if (isEdit) {
      fetchTenderDetail();
    }
  }, [id]);

  const fetchTenderDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tenders/${id}`);
      const data = res.data?.data || res.data || {};
      form.setFieldsValue({
        title: data.title,
        tenderNo: data.tenderNo || data.project_number,
        category: data.category,
        budget: data.budget,
        description: data.description,
        qualification: data.qualification_requirements || data.qualification,
        bidDeadline: (data.bid_deadline || data.bidDeadline) ? dayjs(data.bid_deadline || data.bidDeadline) : null,
        openTime: (data.open_bid_date || data.openTime) ? dayjs(data.open_bid_date || data.openTime) : null,
      });
      setAttachments(data.attachments || []);
    } catch (error) {
      console.error('获取招标详情失败:', error);
      message.error('获取招标详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      message.error(`不支持的文件格式：.${ext}，仅支持 pdf/doc/docx/xls/xlsx`);
      return false;
    }

    if (file.size / 1024 / 1024 > 20) {
      message.error('文件大小不能超过 20MB');
      return false;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await api.post(`/tenders/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newFiles = res.data?.data || [];
      if (newFiles.length > 0) {
        setAttachments([...attachments, ...newFiles]);
        message.success('文件上传成功');
      }
    } catch (error) {
      console.error('上传失败:', error);
      message.error('文件上传失败');
    } finally {
      setUploading(false);
    }

    return false;
  };

  const handleDeleteAttachment = (fileId) => {
    setAttachments(attachments.filter(f => f.id !== fileId));
    message.success('已移除附件');
  };

  const handleSubmit = async (values) => {
    setSubmitLoading(true);
    try {
      const payload = {
        ...values,
        bidDeadline: values.bidDeadline ? values.bidDeadline.format('YYYY-MM-DD HH:mm:ss') : null,
        openTime: values.openTime ? values.openTime.format('YYYY-MM-DD HH:mm:ss') : null,
      };

      let tenderId = id;

      if (isEdit) {
        await api.put(`/tenders/${id}`, payload);
        message.success('更新成功');
      } else {
        const res = await api.post('/tenders', payload);
        tenderId = res.data?.data?.id;
        message.success('创建成功');
      }

      if (tenderId && attachments.length > 0) {
        for (const file of attachments) {
          if (file.originFileObj) {
            const formData = new FormData();
            formData.append('files', file.originFileObj);
            await api.post(`/tenders/${tenderId}/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
            }).catch(err => console.error('附件上传失败:', err));
          }
        }
      }

      navigate('/admin/tenders');
    } catch (error) {
      console.error('提交失败:', error);
      message.error(error.response?.data?.message || '提交失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <Card
        title={isEdit ? '编辑招标项目' : '新建招标项目'}
        loading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          style={{ maxWidth: 720 }}
          initialValues={{ category: 'engineering' }}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入招标标题' }]}
          >
            <Input placeholder="请输入招标项目标题" />
          </Form.Item>

          <Form.Item
            label="项目编号"
            name="tenderNo"
            rules={[{ required: true, message: '请输入项目编号' }]}
          >
            <Input placeholder="请输入项目编号，如 ZB-2026-001" />
          </Form.Item>

          <Form.Item
            label="分类"
            name="category"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              <Option value="engineering">工程类</Option>
              <Option value="goods">货物类</Option>
              <Option value="service">服务类</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="限价金额（元）"
            name="budget"
            extra="设置限价金额后，供应商可见；若不设置则表示不限价，供应商不可见"
          >
            <InputNumber
              placeholder="不填写表示不限价"
              min={0}
              precision={2}
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/,/g, '')}
            />
          </Form.Item>

          <Form.Item
            label="描述"
            name="description"
          >
            <TextArea rows={4} placeholder="请输入项目描述" />
          </Form.Item>

          <Form.Item
            label="资质要求"
            name="qualification"
          >
            <TextArea rows={4} placeholder="请输入资质要求" />
          </Form.Item>

          <Form.Item
            label="投标截止时间"
            name="bidDeadline"
            rules={[{ required: true, message: '请选择投标截止时间' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              placeholder="请选择投标截止时间"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            label="开标时间"
            name="openTime"
            rules={[{ required: true, message: '请选择开标时间' }]}
          >
            <DatePicker
              showTime
              format="YYYY-MM-DD HH:mm"
              placeholder="请选择开标时间"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Divider />

          <Form.Item
            label="招标文件附件"
            extra="上传招标报价书等标准文件，供应商可下载查看。支持 pdf/doc/docx/xls/xlsx 格式，单个文件不超过20MB"
          >
            {isEdit ? (
              <>
                <Upload
                  beforeUpload={handleUpload}
                  showUploadList={false}
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                >
                  <Button icon={<UploadOutlined />} loading={uploading}>
                    上传附件
                  </Button>
                </Upload>

                {attachments.length > 0 && (
                  <List
                    size="small"
                    style={{ marginTop: 16 }}
                    dataSource={attachments}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          <Popconfirm
                            key="delete"
                            title="确定要删除此附件吗？"
                            onConfirm={() => handleDeleteAttachment(file.id)}
                            okText="确定"
                            cancelText="取消"
                          >
                            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        ]}
                      >
                        <Space>
                          <PaperClipOutlined />
                          <span>{file.name}</span>
                          <span style={{ color: '#999', fontSize: 12 }}>
                            ({formatFileSize(file.size)})
                          </span>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </>
            ) : (
              <>
                <Upload
                  beforeUpload={(file) => {
                    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
                    const ext = file.name.split('.').pop().toLowerCase();
                    if (!allowedExtensions.includes(ext)) {
                      message.error(`不支持的文件格式：.${ext}`);
                      return false;
                    }
                    if (file.size / 1024 / 1024 > 20) {
                      message.error('文件大小不能超过 20MB');
                      return false;
                    }
                    setAttachments(prev => [...prev, {
                      id: Date.now() + Math.random(),
                      name: file.name,
                      size: file.size,
                      originFileObj: file
                    }]);
                    return false;
                  }}
                  showUploadList={false}
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                >
                  <Button icon={<UploadOutlined />}>选择附件</Button>
                </Upload>
                {attachments.length > 0 && (
                  <List
                    size="small"
                    style={{ marginTop: 16 }}
                    dataSource={attachments}
                    renderItem={(file) => (
                      <List.Item
                        actions={[
                          <Button key="del" type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDeleteAttachment(file.id)}>
                            删除
                          </Button>
                        ]}
                      >
                        <Space>
                          <PaperClipOutlined />
                          <span>{file.name}</span>
                          <span style={{ color: '#999', fontSize: 12 }}>({formatFileSize(file.size)})</span>
                        </Space>
                      </List.Item>
                    )}
                  />
                )}
              </>
            )}
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={submitLoading}>
                {isEdit ? '更新' : '创建'}
              </Button>
              <Button onClick={() => navigate('/admin/tenders')}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default TenderForm;
