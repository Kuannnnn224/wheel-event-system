import { Alert, Button, Form, InputNumber, Progress, Space, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { api, fetchStages } from '../api/client';
import type { SimulationJob, StageConfig } from '../api/types';

const countOptions = [
  { label: '100 萬', description: '快速壓測', value: 1_000_000 },
  { label: '500 萬', description: '中量級樣本', value: 5_000_000 },
  { label: '1000 萬', description: '最大樣本', value: 10_000_000 },
  { label: '自訂', description: '手動輸入次數', value: 0 },
];

const fallbackStages: StageConfig[] = Array.from({ length: 5 }, (_, index) => ({
  stageNumber: index + 1,
  turnoverThresholdPoints: 0,
  lowTableWeight: 80,
  highTableWeight: 20,
  prizes: [],
}));

function formatRate(count: number, total: number) {
  return total > 0 ? `${((count / total) * 100).toFixed(4)}%` : '0.0000%';
}

function mergePrizeResults(job: SimulationJob) {
  const resultMap = new Map<string, SimulationJob['prizeResults'][number]>();

  for (const row of job.prizeResults) {
    const key = `${row.rewardCode}:${row.name}:${row.amountPoints}`;
    const current = resultMap.get(key) ?? {
      rewardCode: row.rewardCode,
      name: row.name,
      amountPoints: row.amountPoints,
      count: 0,
      totalAmountPoints: 0,
    };

    current.count += row.count;
    current.totalAmountPoints += row.totalAmountPoints;
    resultMap.set(key, current);
  }

  return [...resultMap.values()].sort((a, b) => a.rewardCode.localeCompare(b.rewardCode));
}

export default function BulkSimulationPage() {
  const [form] = Form.useForm<{ customCount?: number }>();
  const [selectedStage, setSelectedStage] = useState(1);
  const [job, setJob] = useState<SimulationJob>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [countMode, setCountMode] = useState(1_000_000);
  const stagesQuery = useQuery({
    queryKey: ['probability-stages'],
    queryFn: fetchStages,
  });
  const stages = useMemo(
    () => [...(stagesQuery.data?.length ? stagesQuery.data : fallbackStages)].sort((a, b) => a.stageNumber - b.stageNumber),
    [stagesQuery.data],
  );
  const selectedStageConfig = stages.find((stage) => stage.stageNumber === selectedStage);
  const mergedPrizeResults = useMemo(() => (job ? mergePrizeResults(job) : []), [job]);
  const completedCount = job?.completedCount ?? 0;
  const lowCount =
    job?.tableResults?.find((result) => result.probabilityTable === 'low')?.count ??
    job?.prizeResults.filter((result) => result.probabilityTable === 'low').reduce((sum, result) => sum + result.count, 0) ??
    0;
  const highCount =
    job?.tableResults?.find((result) => result.probabilityTable === 'high')?.count ??
    job?.prizeResults.filter((result) => result.probabilityTable === 'high').reduce((sum, result) => sum + result.count, 0) ??
    0;
  const averageAmountPoints = job?.averageAmountPoints ?? (completedCount > 0 ? (job?.totalAmountPoints ?? 0) / completedCount : 0);

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

  async function createSimulation(values: { customCount?: number }) {
    const count = countMode === 0 ? values.customCount : countMode;

    if (!count) {
      setError('請輸入模擬次數');
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const { data } = await api.post<SimulationJob>('/simulations', {
        stageNumber: selectedStage,
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
      <Form form={form} className="simulation-form" layout="vertical" onFinish={createSimulation}>
        <section className="simulation-control-panel">
          <div className="simulation-control-header">
            <div>
              <Typography.Text type="secondary">選擇模擬階段</Typography.Text>
              <Typography.Title level={4}>Stage {selectedStage}</Typography.Title>
            </div>
            <Button type="primary" htmlType="submit" loading={loading} disabled={!selectedStageConfig}>
              建立任務
            </Button>
          </div>

          <div className="stage-grid">
            {stages.map((stage) => {
              const isSelected = stage.stageNumber === selectedStage;
              const splitTotal = stage.lowTableWeight + stage.highTableWeight;
              const lowRate = splitTotal > 0 ? ((stage.lowTableWeight / splitTotal) * 100).toFixed(0) : '0';
              const highRate = splitTotal > 0 ? ((stage.highTableWeight / splitTotal) * 100).toFixed(0) : '0';

              return (
                <button
                  key={stage.stageNumber}
                  type="button"
                  className={`stage-card ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => setSelectedStage(stage.stageNumber)}
                >
                  <span className="stage-card-top">
                    <span className="stage-badge">Stage {stage.stageNumber}</span>
                  </span>
                  <span className="stage-card-title">第 {stage.stageNumber} 階段</span>
                  <span className="stage-card-meta">
                    流水門檻 {stage.turnoverThresholdPoints.toLocaleString()} 點
                    <br />
                    Low / High {lowRate}% / {highRate}%
                  </span>
                </button>
              );
            })}
          </div>

          <div className="simulation-count-panel">
            <div>
              <Typography.Text type="secondary">模擬次數</Typography.Text>
              <Typography.Title level={4}>樣本大小</Typography.Title>
            </div>
            <div className="count-option-grid">
              {countOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`count-option-card ${countMode === option.value ? 'is-selected' : ''}`}
                  onClick={() => setCountMode(option.value)}
                >
                  <span className="count-option-title">{option.label}</span>
                  <span className="count-option-meta">{option.description}</span>
                </button>
              ))}
            </div>
            {countMode === 0 ? (
              <Form.Item label="自訂次數" name="customCount" rules={[{ required: true, message: '請輸入模擬次數' }]}>
                <InputNumber min={1} max={10_000_000} precision={0} style={{ width: 220 }} />
              </Form.Item>
            ) : null}
          </div>
        </section>
      </Form>
      {stagesQuery.isError ? <Alert type="warning" showIcon message="階段設定載入失敗，暫時使用預設 5 階段顯示。" /> : null}
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {job ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <section className="result-panel simulation-result-panel">
            <div className="simulation-job-header">
              <div>
                <Typography.Text type="secondary">Job</Typography.Text>
                <Typography.Text strong copyable>
                  {job.id}
                </Typography.Text>
              </div>
              <Tag color={job.status === 'completed' ? 'green' : job.status === 'failed' ? 'red' : 'blue'}>
                {job.status.toUpperCase()}
              </Tag>
            </div>
            <Progress percent={job.progressPercent} status={job.status === 'failed' ? 'exception' : undefined} />
            <Typography.Text>
              {job.completedCount.toLocaleString()} / {job.requestedCount.toLocaleString()} 次
            </Typography.Text>
            <div className="metrics-grid simulation-metrics">
              <div className="metric">
                <span className="metric-label">Low 進入率</span>
                <span className="metric-value">{formatRate(lowCount, completedCount)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">High 進入率</span>
                <span className="metric-value">{formatRate(highCount, completedCount)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">總送出點數</span>
                <span className="metric-value">{job.totalAmountPoints.toLocaleString()}</span>
              </div>
              <div className="metric">
                <span className="metric-label">平均送出點數</span>
                <span className="metric-value">{averageAmountPoints.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
              </div>
            </div>
            {job.error ? <Alert type="error" showIcon message={job.error} style={{ marginTop: 12 }} /> : null}
          </section>
          <Table
            rowKey={(row) => `${row.rewardCode}-${row.name}-${row.amountPoints}`}
            dataSource={mergedPrizeResults}
            columns={[
              { title: '代碼', dataIndex: 'rewardCode', render: (value: string) => <Tag>{value}</Tag> },
              { title: '獎項', dataIndex: 'name' },
              { title: '單次點數', dataIndex: 'amountPoints', render: (value: number) => value.toLocaleString() },
              { title: '命中次數', dataIndex: 'count', render: (value: number) => value.toLocaleString() },
              { title: '總點數', dataIndex: 'totalAmountPoints', render: (value: number) => value.toLocaleString() },
              {
                title: '命中率',
                render: (_, row) => formatRate(row.count, Math.max(job.completedCount, 1)),
              },
            ]}
            pagination={false}
          />
        </Space>
      ) : null}
    </div>
  );
}
