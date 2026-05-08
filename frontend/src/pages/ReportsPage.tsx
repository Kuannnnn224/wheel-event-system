import { Alert, Button, DatePicker, Form, Input, Space, Table, Tabs, Typography } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useState } from 'react';
import { api } from '../api/client';
import type { SpinRecord } from '../api/types';

const { RangePicker } = DatePicker;

interface DailyReport {
  businessDate: string;
  totalSpins: number;
  uniquePlayers: number;
  totalAmountPoints: number;
  byStage: Array<{ stageNumber: number; spinCount: number; totalAmountPoints: number }>;
}

interface PlayerReport {
  totalSpins: number;
  totalAmountPoints: number;
  spins: SpinRecord[];
}

export default function ReportsPage() {
  const [daily, setDaily] = useState<DailyReport>();
  const [player, setPlayer] = useState<PlayerReport>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function loadDaily(values: { date: Dayjs }) {
    setLoading(true);
    setError(undefined);
    try {
      const { data } = await api.get<DailyReport>('/reports/daily', {
        params: { date: values.date.format('YYYY-MM-DD') },
      });
      setDaily(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '日報查詢失敗');
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayer(values: { externalId: string; range: [Dayjs, Dayjs] }) {
    setLoading(true);
    setError(undefined);
    try {
      const { data } = await api.get<PlayerReport>('/reports/player', {
        params: {
          externalId: values.externalId,
          startDate: values.range[0].format('YYYY-MM-DD'),
          endDate: values.range[1].format('YYYY-MM-DD'),
        },
      });
      setPlayer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '玩家報表查詢失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Typography.Title level={3}>報表統計</Typography.Title>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Tabs
        items={[
          {
            key: 'daily',
            label: '日報',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Form layout="inline" initialValues={{ date: dayjs() }} onFinish={loadDaily}>
                  <Form.Item label="日期" name="date" rules={[{ required: true }]}>
                    <DatePicker />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    查詢
                  </Button>
                </Form>
                {daily ? (
                  <>
                    <div className="metrics-grid">
                      <div className="metric">
                        <span className="metric-label">總 Spin</span>
                        <span className="metric-value">{daily.totalSpins.toLocaleString()}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">玩家數</span>
                        <span className="metric-value">{daily.uniquePlayers.toLocaleString()}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">送出點數</span>
                        <span className="metric-value">{daily.totalAmountPoints.toLocaleString()}</span>
                      </div>
                    </div>
                    <Table rowKey="stageNumber" dataSource={daily.byStage} pagination={false} columns={[
                      { title: '階段', dataIndex: 'stageNumber' },
                      { title: 'Spin 數', dataIndex: 'spinCount', render: (value: number) => value.toLocaleString() },
                      { title: '送出點數', dataIndex: 'totalAmountPoints', render: (value: number) => value.toLocaleString() },
                    ]} />
                  </>
                ) : null}
              </Space>
            ),
          },
          {
            key: 'player',
            label: '玩家',
            children: (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Form layout="inline" initialValues={{ range: [dayjs(), dayjs()] }} onFinish={loadPlayer}>
                  <Form.Item label="玩家 ID" name="externalId" rules={[{ required: true }]}>
                    <Input placeholder="external id" />
                  </Form.Item>
                  <Form.Item label="區間" name="range" rules={[{ required: true }]}>
                    <RangePicker />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    查詢
                  </Button>
                </Form>
                {player ? (
                  <>
                    <div className="metrics-grid">
                      <div className="metric">
                        <span className="metric-label">總 Spin</span>
                        <span className="metric-value">{player.totalSpins.toLocaleString()}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">送出點數</span>
                        <span className="metric-value">{player.totalAmountPoints.toLocaleString()}</span>
                      </div>
                    </div>
                    <Table<SpinRecord> rowKey="id" dataSource={player.spins} columns={[
                      { title: '日期', dataIndex: 'businessDate' },
                      { title: '階段', dataIndex: 'stageNumber' },
                      { title: '獎項', dataIndex: 'prizeName' },
                      { title: '點數', dataIndex: 'amountPoints', render: (value: number) => value.toLocaleString() },
                    ]} />
                  </>
                ) : null}
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}
