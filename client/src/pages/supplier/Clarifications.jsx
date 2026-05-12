import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Space,
  Modal,
  Typography,
  message,
  List,
  Divider,
  Input,
} from 'antd';
import { PaperClipOutlined, DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const clarificationStatusMap = {
  pending: { label: '待回复', color: 'orange' },
  responded: { label: '已回复', color: 'green' },
  closed: { label: '已关闭', color: 'default' },
};

const Clarifications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clarifications, setClarifications] = useState([]);
  const [selectedClarification, setSelectedClarification] = useState(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [responseVisible, setResponseVisible] = useState(false);
  const [responseContent, setResponseContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchClarifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clarifications/my-requests');
      setClarifications(res.data?.data || res.data || []);
    } catch (err) {
      message.error('获取询标澄清列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClarifications();
  }, [fetchClarifications]);

  const handleViewDetail = (record) => {
    setSelectedClarification(record);
    setDetailVisible(true);
  };

  const handleOpenResponse = (record) => {
    setSelectedClarification(record);
    setResponseContent('');
    setResponseVisible(true);
  };

  const handleSubmitResponse = async () => {
    if (!responseContent.trim()) {
      message.warning('请输入回复内容');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/clarifications/${selectedClarification.id}/respond`, {
        response_content: responseContent,
      });
      message.success('回复提交成功');
      setResponseVisible(false);
      setResponseContent('');
      setSelectedClarification(null);
      fetchClarifications();
    } catch (err) {
      message.error(err.response?.data?.message || '回复提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const columns = [
    {
      title: '招标项目',
      dataIndex: 'tender_title',
      key: 'tender_title',
      ellipsis: true,
    },
    {
      title: '项目编号',
      dataIndex: 'project_number',
      key: 'project_number',
      width: 140,
    },
    {
      title: '询标内容',
      dataIndex: 'request_content',
      key: 'request_content',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const item = clarificationStatusMap[status] || { label: status, color: 'default' };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '时间',
      dataIndex: 'request_date',
      key: 'request_date',
      width: 170,
      render: (val) => (val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
          查看详情
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={4} style={{ marginBottom: 24 }}>
          询标澄清
        </Title>

        <Table
          columns={columns}
          dataSource={clarifications}
          rowKey={(record) => record.id || record._id}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{ emptyText: '暂无询标澄清记录' }}
        />
      </Card>

      <Modal
        title="询标详情"
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedClarification(null);
        }}
        footer={
          selectedClarification?.status === 'pending' ? (
            <Space>
              <Button onClick={() => setDetailVisible(false)}>关闭</Button>
              <Button type="primary" onClick={() => {
                setDetailVisible(false);
                handleOpenResponse(selectedClarification);
              }}>
                回复
              </Button>
            </Space>
          ) : (
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
          )
        }
        width={700}
      >
        {selectedClarification && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="招标项目" span={2}>
                {selectedClarification.tender_title || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="项目编号">
                {selectedClarification.project_number || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={clarificationStatusMap[selectedClarification.status]?.color}>
                  {clarificationStatusMap[selectedClarification.status]?.label || selectedClarification.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="询标时间">
                {selectedClarification.request_date ? dayjs(selectedClarification.request_date).format('YYYY-MM-DD HH:mm') : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">询标内容</Divider>
            <div style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{selectedClarification.request_content}</div>

            {selectedClarification.responses && selectedClarification.responses.length > 0 && (
              <>
                <Divider orientation="left">回复记录</Divider>
                {selectedClarification.responses.map((response, index) => (
                  <Card key={response.id || index} size="small" style={{ marginBottom: 16 }}>
                    <p style={{ marginBottom: 8 }}>
                      <Text type="secondary">回复时间：</Text>
                      {response.response_date ? dayjs(response.response_date).format('YYYY-MM-DD HH:mm') : '-'}
                    </p>
                    <div style={{ whiteSpace: 'pre-wrap', marginBottom: response.attachments?.length > 0 ? 8 : 0 }}>
                      {response.response_content}
                    </div>
                    {response.attachments && response.attachments.length > 0 && (
                      <List
                        size="small"
                        dataSource={response.attachments}
                        renderItem={(file) => (
                          <List.Item>
                            <Space>
                              <PaperClipOutlined />
                              <span>{file.name}</span>
                              <span style={{ color: '#999', fontSize: 12 }}>
                                ({formatFileSize(file.size)})
                              </span>
                              <Button type="link" size="small" icon={<DownloadOutlined />} href={file.path} target="_blank">
                                下载
                              </Button>
                            </Space>
                          </List.Item>
                        )}
                      />
                    )}
                  </Card>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="回复询标"
        open={responseVisible}
        onOk={handleSubmitResponse}
        onCancel={() => {
          setResponseVisible(false);
          setResponseContent('');
          setSelectedClarification(null);
        }}
        okText="提交回复"
        cancelText="取消"
        confirmLoading={submitting}
      >
        {selectedClarification && (
          <div>
            <p style={{ marginBottom: 8 }}>
              <Text type="secondary">招标项目：</Text>
              {selectedClarification.tender_title}
            </p>
            <p style={{ marginBottom: 16 }}>
              <Text type="secondary">询标内容：</Text>
            </p>
            <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, marginBottom: 16, whiteSpace: 'pre-wrap' }}>
              {selectedClarification.request_content}
            </div>
            <TextArea
              rows={4}
              value={responseContent}
              onChange={(e) => setResponseContent(e.target.value)}
              placeholder="请输入回复内容..."
              maxLength={2000}
              showCount
            />
            <p style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
              提示：您可以上传附件来补充说明回复内容
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Clarifications;
