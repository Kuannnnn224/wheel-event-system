import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { login } from '../api/client';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  return (
    <main className="login-page">
      <section className="login-panel">
        <Typography.Title level={3}>轉盤後控</Typography.Title>
        <Form
          layout="vertical"
          initialValues={{ username: 'admin', password: 'admin123' }}
          onFinish={async (values) => {
            setLoading(true);
            setError(undefined);
            try {
              await login(values.username, values.password);
              onLogin();
            } catch (err) {
              setError(err instanceof Error ? err.message : '登入失敗');
            } finally {
              setLoading(false);
            }
          }}
        >
          {error ? <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} /> : null}
          <Form.Item label="帳號" name="username" rules={[{ required: true }]}>
            <Input autoComplete="username" />
          </Form.Item>
          <Form.Item label="密碼" name="password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            登入
          </Button>
        </Form>
      </section>
    </main>
  );
}
