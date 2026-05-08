import { Typography } from 'antd';
import AwardOverridePanel from '../components/AwardOverridePanel';

export default function AwardOverridesPage() {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <Typography.Title level={3}>指定派獎</Typography.Title>
          <Typography.Text type="secondary">為玩家指定 VIP 階段派獎，並管理當日 pending 規則</Typography.Text>
        </div>
      </div>
      <AwardOverridePanel />
    </div>
  );
}
