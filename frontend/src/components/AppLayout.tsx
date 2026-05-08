import {
  BarChartOutlined,
  ControlOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

interface AppLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

const menuItems = [
  { key: '/spin-simulator', icon: <PlayCircleOutlined />, label: '抽獎模擬' },
  { key: '/players', icon: <TeamOutlined />, label: '查詢玩家' },
  { key: '/reports', icon: <BarChartOutlined />, label: '報表統計' },
  { key: '/bulk-simulation', icon: <ExperimentOutlined />, label: '多次模擬' },
  { key: '/demo', icon: <ControlOutlined />, label: 'Demo 網站' },
  { key: '/probability', icon: <SettingOutlined />, label: '機率設定' },
];

export default function AppLayout({ children, onLogout }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout className="app-shell">
      <Sider width={232} className="app-sider">
        <div className="brand-block">
          <div className="brand-mark">W</div>
          <div className="brand-copy">
            <Typography.Title level={4}>轉盤後控</Typography.Title>
            <Typography.Text type="secondary">Wheel Admin</Typography.Text>
          </div>
        </div>
        <Menu
          className="app-menu"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={(item) => navigate(item.key)}
        />
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text className="section-kicker">每日 5 階段轉盤活動</Typography.Text>
          <Space size={12}>
            <Tag color="processing">Asia/Taipei</Tag>
            <Button icon={<LogoutOutlined />} onClick={onLogout}>
              登出
            </Button>
          </Space>
        </Header>
        <Content className="app-content">{children}</Content>
      </Layout>
    </Layout>
  );
}
