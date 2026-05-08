import { Alert, Button, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { api } from '../api/client';
import type { Player } from '../api/types';

interface DemoSession {
  player: Player;
  token: string;
  expiresAt: string;
  webviewUrl: string;
}

export default function DemoSitePage() {
  const [session, setSession] = useState<DemoSession>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function createSession(values: { externalId: string }) {
    setLoading(true);
    setError(undefined);

    try {
      const { data } = await api.post<DemoSession>('/demo/session', values);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立 demo session 失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Typography.Title level={3}>Demo 網站</Typography.Title>
      <Form className="toolbar" layout="vertical" onFinish={createSession}>
        <Form.Item label="玩家 ID" name="externalId" rules={[{ required: true }]}>
          <Input placeholder="demo-player-001" />
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
            <Typography.Text>到期：{session.expiresAt}</Typography.Text>
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
