import { Alert, Button, Form, Input, InputNumber, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';
import { api } from '../api/client';
import type { Player } from '../api/types';

interface WebviewSession {
  player: Player;
  token: string;
  expiresAt: number;
  webviewUrl: string;
}

export default function WebviewToolPage() {
  const [session, setSession] = useState<WebviewSession>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function createSession(values: { externalId: string; turnoverPoints: number }) {
    setLoading(true);
    setError(undefined);

    try {
      const { data } = await api.post<WebviewSession>('/admin/webview-sessions', values);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立 webview session 失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Typography.Title level={3}>Webview 工具</Typography.Title>
      <Alert type="info" showIcon message="此工具只允許開發環境建立連結，正式環境請由 app 建立 webview session。" />
      <Form className="toolbar" layout="vertical" onFinish={createSession}>
        <Form.Item label="玩家 ID" name="externalId" rules={[{ required: true }]}>
          <Input placeholder="player-001" />
        </Form.Item>
        <Form.Item
          label="當日流水"
          name="turnoverPoints"
          initialValue={0}
          rules={[{ required: true, type: 'number', min: 0 }]}
        >
          <InputNumber min={0} precision={0} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            建立 Webview 連結
          </Button>
        </Form.Item>
      </Form>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {session ? (
        <section className="result-panel">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text>玩家：{session.player.externalId}</Typography.Text>
            <Typography.Text>到期：{dayjs.unix(session.expiresAt).format('YYYY-MM-DD HH:mm:ss')}</Typography.Text>
            <Input.TextArea value={session.webviewUrl} rows={3} readOnly />
            <Button href={session.webviewUrl} target="_blank" rel="noreferrer">
              開啟連結
            </Button>
          </Space>
        </section>
      ) : null}
    </div>
  );
}
