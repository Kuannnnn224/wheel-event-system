import {
  BarChartOutlined,
  ClockCircleOutlined,
  ControlOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Button, Layout, Menu, Space, Tag, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { DailyReport } from '../api/types';

const { Header, Sider, Content } = Layout;
const BUSINESS_TIME_ZONE = 'Asia/Taipei';

interface AppLayoutProps {
  children: ReactNode;
  onLogout: () => void;
}

const primaryMenuItems = [
  { key: '/spin-simulator', icon: <PlayCircleOutlined />, label: '抽獎模擬' },
  { key: '/players', icon: <TeamOutlined />, label: '查詢玩家' },
  { key: '/reports', icon: <BarChartOutlined />, label: '報表統計' },
  { key: '/bulk-simulation', icon: <ExperimentOutlined />, label: '多次模擬' },
  { key: '/probability', icon: <SettingOutlined />, label: '機率設定' },
  { key: '/demo', icon: <ControlOutlined />, label: 'Demo 網站' },
];

function getTaipeiParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  }).formatToParts(date);

  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function formatTaipeiDateTime(date = new Date()) {
  const parts = getTaipeiParts(date);
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function formatTaipeiDate(date = new Date()) {
  const parts = getTaipeiParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export default function AppLayout({ children, onLogout }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDateTime, setCurrentDateTime] = useState(() => formatTaipeiDateTime());
  const [dailyReport, setDailyReport] = useState<DailyReport>();
  const [dailyReportError, setDailyReportError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(formatTaipeiDateTime());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDailyReport() {
      try {
        const { data } = await api.get<DailyReport>('/reports/daily', {
          params: { date: formatTaipeiDate() },
        });

        if (active) {
          setDailyReport(data);
          setDailyReportError(false);
        }
      } catch {
        if (active) {
          setDailyReportError(true);
        }
      }
    }

    void loadDailyReport();
    const timer = window.setInterval(loadDailyReport, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
          items={primaryMenuItems}
          onClick={(item) => navigate(item.key)}
        />
        <div className="sidebar-footer">
          <div className="sidebar-daily-card">
            <span className="sidebar-daily-label">今日送出</span>
            <strong>{dailyReportError ? '-' : `${(dailyReport?.totalAmountPoints ?? 0).toLocaleString()} 點`}</strong>
            <span>{dailyReportError ? '讀取失敗' : `${dailyReport?.totalSpins ?? 0} 次抽獎 · 每分鐘刷新`}</span>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header className="app-header">
          <Typography.Text className="section-kicker">每日 5 階段轉盤活動</Typography.Text>
          <Space size={12}>
            <span className="header-clock">
              <ClockCircleOutlined />
              {currentDateTime}
            </span>
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
