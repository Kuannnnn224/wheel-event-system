import { Alert, Button, DatePicker, Form, Input, InputNumber, Table, Typography } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { useState } from 'react';
import { api, fetchPlayerByExternalId } from '../api/client';
import type { Player, PlayerDailyProgress, SpinRecord } from '../api/types';

interface SearchValues {
  externalId: string;
  date: Dayjs;
}

export default function PlayerLookupPage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [progress, setProgress] = useState<PlayerDailyProgress>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [date, setDate] = useState(dayjs());

  async function loadProgress(nextPlayer: Player, businessDate: Dayjs) {
    const { data } = await api.get<PlayerDailyProgress>(`/players/${nextPlayer.id}/daily-progress`, {
      params: { date: businessDate.format('YYYY-MM-DD') },
    });
    setProgress(data);
  }

  async function search(values: SearchValues) {
    setLoading(true);
    setError(undefined);
    setProgress(undefined);
    setDate(values.date);

    try {
      const found = await fetchPlayerByExternalId(values.externalId);
      setPlayer(found);

      if (found) {
        await loadProgress(found, values.date);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setLoading(false);
    }
  }

  async function addTurnover(values: { amountPoints: number; reason?: string }) {
    if (!player) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const { data } = await api.post<PlayerDailyProgress>(`/players/${player.id}/turnover-adjustments`, {
        amountPoints: values.amountPoints,
        reason: values.reason,
        date: date.format('YYYY-MM-DD'),
      });
      setProgress(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加流水失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Typography.Title level={3}>查詢玩家</Typography.Title>
      <Form className="toolbar" layout="vertical" initialValues={{ date }} onFinish={search}>
        <Form.Item label="玩家 ID" name="externalId" rules={[{ required: true }]}>
          <Input placeholder="external id" />
        </Form.Item>
        <Form.Item label="日期" name="date" rules={[{ required: true }]}>
          <DatePicker />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            查詢
          </Button>
        </Form.Item>
      </Form>

      {error ? <Alert type="error" showIcon message={error} /> : null}
      {player === null && !progress ? <Alert type="info" showIcon message="尚未載入玩家資料" /> : null}
      {player && !progress ? <Alert type="warning" showIcon message="玩家存在，但此日期尚無流水或抽獎紀錄" /> : null}

      {progress ? (
        <>
          <div className="metrics-grid">
            <div className="metric">
              <span className="metric-label">累積流水</span>
              <span className="metric-value">{progress.turnoverPoints.toLocaleString()}</span>
            </div>
            <div className="metric">
              <span className="metric-label">解鎖階段</span>
              <span className="metric-value">{progress.unlockedStage}</span>
            </div>
            <div className="metric">
              <span className="metric-label">已玩階段</span>
              <span className="metric-value">{progress.playedStages.join(', ') || '-'}</span>
            </div>
            <div className="metric">
              <span className="metric-label">中獎點數</span>
              <span className="metric-value">{progress.totalWinPoints.toLocaleString()}</span>
            </div>
          </div>

          <Form className="toolbar" layout="vertical" onFinish={addTurnover}>
            <Form.Item label="新增流水" name="amountPoints" rules={[{ required: true }]}>
              <InputNumber min={1} precision={0} />
            </Form.Item>
            <Form.Item label="備註" name="reason">
              <Input placeholder="manual adjustment" />
            </Form.Item>
            <Form.Item>
              <Button htmlType="submit" loading={loading}>
                加流水
              </Button>
            </Form.Item>
          </Form>

          <Table<SpinRecord>
            rowKey="id"
            dataSource={progress.spins}
            pagination={false}
            columns={[
              { title: '階段', dataIndex: 'stageNumber' },
              { title: '獎項', dataIndex: 'prizeName' },
              { title: '點數', dataIndex: 'amountPoints', render: (value: number) => value.toLocaleString() },
              { title: '時間', dataIndex: 'createdAt', render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm:ss') },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}
