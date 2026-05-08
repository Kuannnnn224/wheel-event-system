import { Alert, Button, Form, InputNumber, Progress, Radio, Space, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { SimulationJob } from '../api/types';

const countOptions = [
  { label: '100 萬', value: 1_000_000 },
  { label: '500 萬', value: 5_000_000 },
  { label: '1000 萬', value: 10_000_000 },
  { label: '自訂', value: 0 },
];

export default function BulkSimulationPage() {
  const [job, setJob] = useState<SimulationJob>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [countMode, setCountMode] = useState(1_000_000);

  useEffect(() => {
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return undefined;
    }

    const timer = window.setInterval(async () => {
      const { data } = await api.get<SimulationJob>(`/simulations/${job.id}`);
      setJob(data);
    }, 1200);

    return () => window.clearInterval(timer);
  }, [job]);

  async function createSimulation(values: { stageNumber: number; customCount?: number }) {
    const count = countMode === 0 ? values.customCount : countMode;

    if (!count) {
      setError('請輸入模擬次數');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const { data } = await api.post<SimulationJob>('/simulations', {
        stageNumber: values.stageNumber,
        count,
      });
      setJob(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立模擬任務失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Typography.Title level={3}>多次模擬</Typography.Title>
      <Form layout="vertical" initialValues={{ stageNumber: 1 }} onFinish={createSimulation}>
        <div className="toolbar">
          <Form.Item label="階段" name="stageNumber" rules={[{ required: true }]}>
            <InputNumber min={1} max={5} precision={0} />
          </Form.Item>
          <Form.Item label="次數">
            <Radio.Group options={countOptions} value={countMode} onChange={(event) => setCountMode(event.target.value)} />
          </Form.Item>
          {countMode === 0 ? (
            <Form.Item label="自訂次數" name="customCount" rules={[{ required: true }]}>
              <InputNumber min={1} max={10_000_000} precision={0} />
            </Form.Item>
          ) : null}
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              建立任務
            </Button>
          </Form.Item>
        </div>
      </Form>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {job ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <section className="result-panel">
            <Typography.Text strong>Job {job.id}</Typography.Text>
            <Progress percent={job.progressPercent} status={job.status === 'failed' ? 'exception' : undefined} />
            <Typography.Text>
              {job.status} · {job.completedCount.toLocaleString()} / {job.requestedCount.toLocaleString()} · 送出點數{' '}
              {job.totalAmountPoints.toLocaleString()}
            </Typography.Text>
            {job.error ? <Alert type="error" showIcon message={job.error} style={{ marginTop: 12 }} /> : null}
          </section>
          <Table
            rowKey={(row) => `${row.probabilityTable}-${row.rewardCode}-${row.name}-${row.amountPoints}`}
            dataSource={job.prizeResults}
            columns={[
              { title: '表', dataIndex: 'probabilityTable', render: (value: string) => value.toUpperCase() },
              { title: '代碼', dataIndex: 'rewardCode' },
              { title: '獎項', dataIndex: 'name' },
              { title: '單次點數', dataIndex: 'amountPoints', render: (value: number) => value.toLocaleString() },
              { title: '命中次數', dataIndex: 'count', render: (value: number) => value.toLocaleString() },
              { title: '總點數', dataIndex: 'totalAmountPoints', render: (value: number) => value.toLocaleString() },
              {
                title: '命中率',
                render: (_, row) => `${((row.count / Math.max(job.requestedCount, 1)) * 100).toFixed(4)}%`,
              },
            ]}
          />
        </Space>
      ) : null}
    </div>
  );
}
