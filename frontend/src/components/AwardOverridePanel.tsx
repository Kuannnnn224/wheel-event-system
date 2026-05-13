import { Alert, Button, Checkbox, Form, Input, Space, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cancelAwardOverride, createAwardOverrides, fetchAwardOverrides, getApiErrorMessage } from '../api/client';
import type { AwardOverrideRule } from '../api/types';

const STAGE_OPTIONS = [1, 2, 3, 4, 5].map((stageNumber) => ({
  label: `LV${stageNumber}`,
  value: stageNumber,
}));

const STATUS_META: Record<AwardOverrideRule['status'], { label: string; color: string }> = {
  pending: { label: '等待派獎', color: 'processing' },
  consumed: { label: '已派彩', color: 'success' },
  cancelled: { label: '已取消', color: 'default' },
};

interface AwardOverridePanelProps {
  fixedPlayerId?: string;
  title?: string;
  description?: string;
}

interface AwardOverrideFormValues {
  playerId?: string;
  stageNumbers: Array<string | number | boolean>;
  reason?: string;
}

function formatTimestamp(value?: number) {
  if (!value) {
    return '-';
  }

  return dayjs(value > 1_000_000_000_000 ? value : value * 1000).format('YYYY-MM-DD HH:mm:ss');
}

function formatPoints(value?: number | null) {
  return Number(value ?? 0).toLocaleString();
}

export default function AwardOverridePanel({
  fixedPlayerId,
  title = '指定派獎',
  description = '建立與管理當日所有指定派獎紀錄',
}: AwardOverridePanelProps) {
  const navigate = useNavigate();
  const [form] = Form.useForm<AwardOverrideFormValues>();
  const [rules, setRules] = useState<AwardOverrideRule[]>([]);
  const [filterPlayerId, setFilterPlayerId] = useState(fixedPlayerId ?? '');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string>();
  const [error, setError] = useState<string>();
  const activePlayerId = fixedPlayerId ?? filterPlayerId;
  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => b.createdAt - a.createdAt || a.stageNumber - b.stageNumber),
    [rules],
  );

  async function loadRules(nextPlayerId = activePlayerId) {
    setLoading(true);
    setError(undefined);

    try {
      setRules(await fetchAwardOverrides(nextPlayerId.trim() || undefined));
    } catch (err) {
      setError(getApiErrorMessage(err, '指定派獎讀取失敗'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setFilterPlayerId(fixedPlayerId ?? '');
    form.resetFields();
    void loadRules(fixedPlayerId ?? '');
  }, [fixedPlayerId]);

  async function submit(values: AwardOverrideFormValues) {
    const playerId = (fixedPlayerId ?? values.playerId ?? '').trim();
    const stageNumbers = values.stageNumbers.map(Number);

    if (!playerId || stageNumbers.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(undefined);

    try {
      await createAwardOverrides({
        playerId,
        stageNumbers,
        reason: values.reason?.trim() || undefined,
      });
      setFilterPlayerId(playerId);
      form.resetFields(['stageNumbers', 'reason']);
      await loadRules(playerId);
    } catch (err) {
      setError(getApiErrorMessage(err, '指定派獎建立失敗'));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelRule(rule: AwardOverrideRule) {
    setCancellingId(rule.id);
    setError(undefined);

    try {
      await cancelAwardOverride(rule.id);
      await loadRules(activePlayerId);
    } catch (err) {
      setError(getApiErrorMessage(err, '取消指定派獎失敗'));
    } finally {
      setCancellingId(undefined);
    }
  }

  function openPlayerLookup(rule: AwardOverrideRule) {
    const playerId = rule.player?.id ?? activePlayerId;

    if (!playerId) {
      return;
    }

    navigate(`/players?playerId=${encodeURIComponent(playerId)}`);
  }

  function renderConsumedReward(rule: AwardOverrideRule) {
    if (rule.status !== 'consumed') {
      return <Typography.Text type="secondary">-</Typography.Text>;
    }

    if (!rule.consumedSpinRecord) {
      return <Typography.Text type="secondary">已派彩，無抽獎明細</Typography.Text>;
    }

    return (
      <Space direction="vertical" size={0}>
        <Typography.Text strong>{rule.consumedSpinRecord.prizeName}</Typography.Text>
        <Typography.Text type="secondary">派發 {formatPoints(rule.consumedSpinRecord.amountPoints)} 點</Typography.Text>
      </Space>
    );
  }

  return (
    <section className="award-override-panel">
      <div className="award-override-header">
        <div>
          <span className="section-kicker">Award Override</span>
          <Typography.Title level={4}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <Button onClick={() => void loadRules()} loading={loading}>
          重新整理
        </Button>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Form
        form={form}
        className="award-override-form"
        layout="vertical"
        initialValues={{ playerId: fixedPlayerId, stageNumbers: [] }}
        onFinish={submit}
      >
        {fixedPlayerId ? null : (
          <Form.Item label="玩家 ID" name="playerId" rules={[{ required: true }]}>
            <Input
              placeholder="player-001"
              onChange={(event) => setFilterPlayerId(event.target.value)}
              onPressEnter={() => void loadRules(filterPlayerId)}
            />
          </Form.Item>
        )}
        <Form.Item label="指定階段" name="stageNumbers" rules={[{ required: true, message: '請選擇至少一個 LV 階段' }]}>
          <Checkbox.Group options={STAGE_OPTIONS} />
        </Form.Item>
        <Form.Item label="備註" name="reason">
          <Input placeholder="optional reason" />
        </Form.Item>
        <Form.Item>
          <Space wrap>
            <Button type="primary" htmlType="submit" loading={submitting}>
              新增指定派獎
            </Button>
            {!fixedPlayerId ? (
              <Button onClick={() => void loadRules(filterPlayerId)} loading={loading}>
                查詢紀錄
              </Button>
            ) : null}
          </Space>
        </Form.Item>
      </Form>

      <Table<AwardOverrideRule>
        className="award-override-table"
        rowKey="id"
        loading={loading}
        dataSource={sortedRules}
        pagination={{ pageSize: 8, showSizeChanger: false }}
        columns={[
          {
            title: '玩家 ID',
            render: (_, rule) => {
              const playerId = rule.player?.id ?? (activePlayerId || rule.playerId);

              return (
                <Space size={8}>
                  <Typography.Text>{playerId}</Typography.Text>
                  <Button size="small" aria-label={`查詢玩家 ${playerId}`} onClick={() => openPlayerLookup(rule)}>
                    查詢
                  </Button>
                </Space>
              );
            },
          },
          {
            title: '日期',
            dataIndex: 'businessDate',
          },
          {
            title: '階段',
            dataIndex: 'stageNumber',
            render: (value: number) => <Tag color="magenta">LV{value}</Tag>,
          },
          {
            title: '狀態',
            dataIndex: 'status',
            render: (value: AwardOverrideRule['status']) => {
              const meta = STATUS_META[value] ?? { label: value, color: 'default' };
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
          {
            title: '實際獎勵',
            render: (_, rule) => renderConsumedReward(rule),
          },
          {
            title: '備註',
            dataIndex: 'reason',
            render: (value?: string) => value || '-',
          },
          {
            title: '建立時間',
            dataIndex: 'createdAt',
            render: formatTimestamp,
          },
          {
            title: '',
            align: 'right',
            render: (_, rule) => (
              rule.status === 'pending' ? (
                <Button danger loading={cancellingId === rule.id} onClick={() => void cancelRule(rule)}>
                  取消
                </Button>
              ) : (
                <Typography.Text type="secondary">-</Typography.Text>
              )
            ),
          },
        ]}
      />
    </section>
  );
}
