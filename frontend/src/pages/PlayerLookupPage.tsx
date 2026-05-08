import { Alert, Button, Form, Input, InputNumber, Table, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { api, fetchPlayerByExternalId, fetchStages } from '../api/client';
import type { Player, PlayerDailyProgress, SpinRecord, StageConfig } from '../api/types';
import AwardOverridePanel from '../components/AwardOverridePanel';
import ProbabilityTableTag from '../components/ProbabilityTableTag';

interface SearchValues {
  externalId: string;
}

interface TurnoverValues {
  amountPoints: number;
  reason?: string;
}

type StageState = 'done' | 'active' | 'waiting' | 'locked';

const STAGE_NUMBERS = [1, 2, 3, 4, 5];

function formatPoints(value?: number | null) {
  return Number(value ?? 0).toLocaleString();
}

function getNextPlayableStage(progress?: PlayerDailyProgress) {
  if (!progress) return 0;

  for (let stageNumber = 1; stageNumber <= progress.unlockedStage; stageNumber += 1) {
    if (!progress.playedStages.includes(stageNumber)) {
      return stageNumber;
    }
  }

  return 0;
}

function getDailyStatus(progress?: PlayerDailyProgress) {
  if (!progress) {
    return { label: '尚未查詢', color: 'default' };
  }

  if (progress.unlockedStage >= 5 && progress.playedStages.length >= 5) {
    return { label: '今日已完成', color: 'green' };
  }

  const nextPlayableStage = getNextPlayableStage(progress);
  if (nextPlayableStage > 0) {
    return { label: `可抽 VIP${nextPlayableStage}`, color: 'processing' };
  }

  if (progress.unlockedStage > 0) {
    return { label: '等待前階完成', color: 'gold' };
  }

  return { label: '尚未解鎖', color: 'default' };
}

function getStageState(progress: PlayerDailyProgress, stageNumber: number): StageState {
  if (progress.playedStages.includes(stageNumber)) {
    return 'done';
  }

  if (stageNumber === getNextPlayableStage(progress)) {
    return 'active';
  }

  if (stageNumber <= progress.unlockedStage) {
    return 'waiting';
  }

  return 'locked';
}

function getStageStateLabel(state: StageState) {
  switch (state) {
    case 'done':
      return '已抽';
    case 'active':
      return '可抽';
    case 'waiting':
      return '待前階';
    case 'locked':
      return '未解鎖';
  }
}

function getStageTagColor(state: StageState) {
  switch (state) {
    case 'done':
      return 'green';
    case 'active':
      return 'processing';
    case 'waiting':
      return 'gold';
    case 'locked':
      return 'default';
  }
}

export default function PlayerLookupPage() {
  const [adjustmentForm] = Form.useForm<TurnoverValues>();
  const [player, setPlayer] = useState<Player | null>(null);
  const [progress, setProgress] = useState<PlayerDailyProgress>();
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [stageConfigError, setStageConfigError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    fetchStages()
      .then(setStages)
      .catch(() => setStageConfigError('階段設定讀取失敗，門檻暫時以 - 顯示'));
  }, []);

  const stagesByNumber = useMemo(() => new Map(stages.map((stage) => [stage.stageNumber, stage])), [stages]);
  const spinsByStage = useMemo(
    () => new Map((progress?.spins ?? []).map((spin) => [spin.stageNumber, spin])),
    [progress],
  );
  const dailyStatus = getDailyStatus(progress);

  async function loadProgress(nextPlayer: Player) {
    const { data } = await api.get<PlayerDailyProgress>(`/players/${nextPlayer.id}/daily-progress`);
    setProgress(data);
  }

  async function search(values: SearchValues) {
    setLoading(true);
    setError(undefined);
    setProgress(undefined);

    try {
      const found = await fetchPlayerByExternalId(values.externalId);
      setPlayer(found);

      if (found) {
        await loadProgress(found);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '查詢失敗');
    } finally {
      setLoading(false);
    }
  }

  async function addTurnover(values: TurnoverValues) {
    if (!player) {
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const { data } = await api.post<PlayerDailyProgress>(`/players/${player.id}/turnover-adjustments`, {
        amountPoints: values.amountPoints,
        reason: values.reason,
      });
      setProgress(data);
      adjustmentForm.resetFields();
    } catch (err) {
      setError(err instanceof Error ? err.message : '加流水失敗');
    } finally {
      setLoading(false);
    }
  }

  function renderStageCard(stageNumber: number) {
    if (!progress) return null;

    const stage = stagesByNumber.get(stageNumber);
    const spin = spinsByStage.get(stageNumber);
    const state = getStageState(progress, stageNumber);
    const threshold = stage?.turnoverThresholdPoints;
    const remaining = threshold === undefined ? undefined : Math.max(threshold - progress.turnoverPoints, 0);

    return (
      <div className={`player-stage-card is-${state}`} key={stageNumber}>
        <div className="player-stage-card-top">
          <span className="stage-badge">VIP{stageNumber}</span>
          <Tag color={getStageTagColor(state)}>{getStageStateLabel(state)}</Tag>
        </div>
        <div>
          <div className="player-stage-title">第 {stageNumber} 階段</div>
          <div className="player-stage-meta">流水門檻 {threshold === undefined ? '-' : `${formatPoints(threshold)} 點`}</div>
        </div>
        <div className="player-stage-detail">
          {spin ? (
            <>
              <div className="player-stage-prize">{spin.prizeName}</div>
              <div className="player-stage-meta">
                <ProbabilityTableTag value={spin.probabilityTable} />
                派發 {formatPoints(spin.amountPoints)} 點
              </div>
            </>
          ) : state === 'locked' ? (
            <span>{remaining === undefined ? '等待階段設定' : `尚差 ${formatPoints(remaining)} 流水`}</span>
          ) : state === 'active' ? (
            <span>玩家今日可抽此階段</span>
          ) : (
            <span>需先完成前一階段</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack player-lookup-page">
      <div className="page-title-row">
        <div>
          <Typography.Title level={3}>查詢玩家</Typography.Title>
          <Typography.Text type="secondary">查看玩家當日輪盤解鎖、抽獎與派發狀態</Typography.Text>
        </div>
      </div>

      <Form className="lookup-search-panel toolbar" layout="vertical" onFinish={search}>
        <Form.Item label="玩家 ID" name="externalId" rules={[{ required: true }]}>
          <Input placeholder="external id" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            查詢
          </Button>
        </Form.Item>
        {player && progress ? (
          <div className="lookup-query-summary">
            <span>玩家 {player.externalId}</span>
            <span>{progress.businessDate}</span>
          </div>
        ) : null}
      </Form>

      {error ? <Alert type="error" showIcon message={error} /> : null}
      {stageConfigError ? <Alert type="warning" showIcon message={stageConfigError} /> : null}
      {player === null && !progress ? <Alert type="info" showIcon message="尚未載入玩家資料" /> : null}
      {player && !progress ? <Alert type="warning" showIcon message="玩家存在，但此日期尚無流水或抽獎紀錄" /> : null}

      {player ? (
        <AwardOverridePanel
          fixedExternalId={player.externalId}
          title="指定派獎"
          description="查詢此玩家當日 pending 指定派獎，並可直接新增 VIP 階段或取消規則"
        />
      ) : null}

      {progress ? (
        <>
          <section className="player-status-panel">
            <div className="player-status-header">
              <div>
                <span className="section-kicker">Daily Wheel Status</span>
                <Typography.Title level={4}>今日輪盤狀態</Typography.Title>
              </div>
              <Tag color={dailyStatus.color}>{dailyStatus.label}</Tag>
            </div>

            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-label">累積流水</span>
                <span className="metric-value">{formatPoints(progress.turnoverPoints)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">解鎖階段</span>
                <span className="metric-value">{progress.unlockedStage ? `VIP${progress.unlockedStage}` : '-'}</span>
              </div>
              <div className="metric">
                <span className="metric-label">已抽次數</span>
                <span className="metric-value">{progress.playedStages.length} / 5</span>
              </div>
              <div className="metric">
                <span className="metric-label">中獎點數</span>
                <span className="metric-value">{formatPoints(progress.totalWinPoints)}</span>
              </div>
            </div>

            <div className="player-stage-grid">{STAGE_NUMBERS.map(renderStageCard)}</div>
          </section>

          <Form form={adjustmentForm} className="lookup-adjustment-panel toolbar" layout="vertical" onFinish={addTurnover}>
            <div className="lookup-panel-heading">
              <span className="section-kicker">PM Control</span>
              <Typography.Title level={4}>後控加流水</Typography.Title>
            </div>
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

          <section className="lookup-history-panel">
            <div className="lookup-panel-heading">
              <span className="section-kicker">Spin History</span>
              <Typography.Title level={4}>抽獎歷程</Typography.Title>
            </div>
            <Table<SpinRecord>
              rowKey="id"
              dataSource={progress.spins}
              pagination={false}
              columns={[
                { title: '階段', dataIndex: 'stageNumber', render: (value: number) => `VIP${value}` },
                {
                  title: '表',
                  dataIndex: 'probabilityTable',
                  render: (value: string) => <ProbabilityTableTag value={value} />,
                },
                { title: '獎項', dataIndex: 'prizeName' },
                {
                  title: '點數',
                  dataIndex: 'amountPoints',
                  align: 'right',
                  render: (value: number) => formatPoints(value),
                },
                { title: '時間', dataIndex: 'createdAt', render: (value: number) => dayjs.unix(value).format('HH:mm:ss') },
              ]}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
