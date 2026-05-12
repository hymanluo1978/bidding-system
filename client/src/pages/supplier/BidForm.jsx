import React, { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Form,
  InputNumber,
  Input,
  Upload,
  Button,
  Space,
  Typography,
  message,
  Spin,
  Modal,
  Tag,
} from 'antd';
import {
  UploadOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';

const { Title } = Typography;
const { TextArea } = Input;

// 与后端 Tender 状态一致
const statusMap = {
  draft: { label: '草稿', color: 'default' },
  published: { label: '招标中', color: 'processing' },
  bidding: { label: '招标中', color: 'processing' },
  evaluation: { label: '评标中', color: 'purple' },
  completed: { label: '已完成', color: 'success' },
  cancelled: { label: '已取消', color: 'error' },
};

const BidForm = () => {
  const navigate = useNavigate();
  const { id: tenderId } = useParams();
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tender, setTender] = useState(null);
  const [hasBid, setHasBid] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [fileList, setFileList] = useState([]);

  useEffect(() => {
    fetchTenderDetail();
    checkBidStatus();
  }, [tenderId]);

  const fetchTenderDetail = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tenders/${tenderId}`);
      setTender(res.data?.data || res.data);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || '网络错误';
      message.error(`获取招标详情失败: ${errMsg}`);
      console.error('招标详情错误:', err.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  const checkBidStatus = async () => {
    try {
      const res = await api.get(`/bids/my-bid/${tenderId}`);
      const bid = res.data?.data || res.data;
      if (bid && bid.id) {
        setHasBid(true);
        message.info('您已对该项目提交过投标');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        // 404 表示未投标，忽略
      } else {
        console.error('检查投标状态失败:', err.response?.data || err);
      }
    }
  };

  const beforeUpload = (file) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];
    const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'png'];
    const ext = file.name.split('.').pop().toLowerCase();

    if (!allowedExtensions.includes(ext)) {
      message.error(
        `不支持的文件格式：.${ext}，仅支持 pdf/doc/docx/xls/xlsx/jpg/png`
      );
      return Upload.LIST_IGNORE;
    }

    const isLt50M = file.size / 1024 / 1024 < 50;
    if (!isLt50M) {
      message.error('文件大小不能超过 50MB');
      return Upload.LIST_IGNORE;
    }

    return true;
  };

  const handleFinish = () => {
    setConfirmVisible(true);
  };

  const handleSubmit = async () => {
    setConfirmVisible(false);
    setSubmitting(true);

    try {
      const formData = new FormData();
      const values = form.getFieldsValue();

      formData.append('tender_id', tenderId);
      formData.append('bid_price', values.price);
      formData.append('technical_proposal', values.technicalProposal || '');
      formData.append('business_proposal', values.commercialProposal || '');

      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj);
        }
      });

      await api.post('/bids', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      message.success('投标提交成功');
      setHasBid(true);
    } catch (err) {
      const errMsg =
        err.response?.data?.message || '投标提交失败，请稍后重试';
      message.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!tender) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <Title level={4}>未找到招标信息</Title>
          <Button onClick={() => navigate('/supplier/tenders')}>返回列表</Button>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Space style={{ marginBottom: 16 }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/supplier/tenders')}
          >
            返回列表
          </Button>
        </Space>

        <Title level={4}>投标 - {tender.title}</Title>

        {/* 招标详情（只读） */}
        <Card
          type="inner"
          title="招标项目信息"
          style={{ marginBottom: 24 }}
          size="small"
        >
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="项目编号">
              {tender.project_number || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const item =
                  statusMap[tender.status] || {
                    label: tender.status,
                    color: 'default',
                  };
                return <Tag color={item.color}>{item.label}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="预算金额">
              {tender.budget != null
                ? `¥ ${Number(tender.budget).toLocaleString()}`
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="投标截止时间">
              {tender.bid_deadline
                ? new Date(tender.bid_deadline).toLocaleString('zh-CN')
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="项目描述" span={2}>
              {tender.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="技术要求" span={2}>
              {tender.requirements || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="商务要求" span={2}>
              {tender.requirements || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* 投标表单 */}
        {hasBid ? (
          <Card type="inner" title="投标状态">
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Tag color="blue" style={{ fontSize: 16, padding: '8px 24px' }}>
                您已提交投标
              </Tag>
              <p style={{ marginTop: 16, color: '#999' }}>
                您已对该项目提交过投标，无需重复提交
              </p>
            </div>
          </Card>
        ) : (
          <Card type="inner" title="填写投标信息">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleFinish}
              style={{ maxWidth: 800 }}
            >
              <Form.Item
                label="报价金额（元）"
                name="price"
                rules={[
                  { required: true, message: '请输入报价金额' },
                  { type: 'number', min: 0, message: '报价金额不能为负数' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  precision={2}
                  placeholder="请输入报价金额"
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                  }
                  parser={(value) =>
                    value.replace(/¥\s?|(,*)/g, '')
                  }
                />
              </Form.Item>

              <Form.Item
                label="技术方案说明"
                name="technicalProposal"
              >
                <TextArea
                  rows={6}
                  placeholder="请输入技术方案说明"
                  maxLength={5000}
                  showCount
                />
              </Form.Item>

              <Form.Item
                label="商务方案说明"
                name="commercialProposal"
              >
                <TextArea
                  rows={6}
                  placeholder="请输入商务方案说明"
                  maxLength={5000}
                  showCount
                />
              </Form.Item>

              <Form.Item label="附件上传">
                <Upload.Dragger
                  fileList={fileList}
                  onChange={({ fileList: newFileList }) =>
                    setFileList(newFileList)
                  }
                  beforeUpload={beforeUpload}
                  multiple
                  maxCount={10}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">
                    点击或拖拽文件到此区域上传
                  </p>
                  <p className="ant-upload-hint">
                    支持 pdf/doc/docx/xls/xlsx/jpg/png 格式，单个文件不超过
                    50MB，最多上传 10 个文件
                  </p>
                </Upload.Dragger>
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={submitting}
                    size="large"
                  >
                    提交投标
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate('/supplier/tenders')}
                  >
                    取消
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        )}
      </Card>

      {/* 提交确认弹窗 */}
      <Modal
        title="确认提交"
        open={confirmVisible}
        onOk={handleSubmit}
        onCancel={() => setConfirmVisible(false)}
        confirmLoading={submitting}
        okText="确认提交"
        cancelText="取消"
      >
        <p>请确认以下投标信息无误后提交：</p>
        <Descriptions bordered column={1} size="small">
          <Descriptions.Item label="报价金额">
            {form.getFieldValue('price') != null
              ? `¥ ${Number(form.getFieldValue('price')).toLocaleString()}`
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="技术方案说明">
            {form.getFieldValue('technicalProposal') || '未填写'}
          </Descriptions.Item>
          <Descriptions.Item label="商务方案说明">
            {form.getFieldValue('commercialProposal') || '未填写'}
          </Descriptions.Item>
          <Descriptions.Item label="附件数量">
            {fileList.length} 个文件
          </Descriptions.Item>
        </Descriptions>
        <p style={{ marginTop: 16, color: '#ff4d4f' }}>
          提交后将不可修改，请确认信息准确无误。
        </p>
      </Modal>
    </div>
  );
};

export default BidForm;
