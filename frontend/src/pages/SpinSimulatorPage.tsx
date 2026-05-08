import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, fetchStages } from '../api/client';
import type { StageConfig } from '../api/types';

interface SimulateResult {
  stageNumber: number;
  prize: {
    id: number;
    name: string;
    amountPoints: number;
  };
}

const fallbackStages: StageConfig[] = Array.from({ length: 5 }, (_, index) => ({
  stageNumber: index + 1,
  turnoverThresholdPoints: 0,
  enabled: true,
  prizes: [],
}));

export default function SpinSimulatorPage() {
  const [selectedStage, setSelectedStage] = useState(1);
  const stagesQuery = useQuery({
    queryKey: ['probability-stages'],
    queryFn: fetchStages,
  });
  const mutation = useMutation({
    mutationFn: async (stageNumber: number) => {
      const { data } = await api.post<SimulateResult>('/spins/simulate', { stageNumber });
      return data;
    },
  });
  const stages = useMemo(
    () => [...(stagesQuery.data?.length ? stagesQuery.data : fallbackStages)].sort((a, b) => a.stageNumber - b.stageNumber),
    [stagesQuery.data],
  );
  const selectedStageConfig = stages.find((stage) => stage.stageNumber === selectedStage);
  const selectedPrizes = useMemo(
    () => [...(selectedStageConfig?.prizes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [selectedStageConfig?.prizes],
  );
  const totalEnabledWeight = selectedPrizes
    .filter((prize) => prize.enabled && prize.weight > 0)
    .reduce((sum, prize) => sum + prize.weight, 0);

  return (
    <div className="page-stack">
      <Typography.Title level={3}>抽獎模擬</Typography.Title>
      <section className="stage-picker-panel">
        <div className="stage-grid">
          {stages.map((stage) => {
            const isSelected = stage.stageNumber === selectedStage;

            return (
              <button
                key={stage.stageNumber}
                type="button"
                className={`stage-card ${isSelected ? 'is-selected' : ''} ${stage.enabled ? '' : 'is-disabled'}`}
                disabled={!stage.enabled}
                onClick={() => {
                  setSelectedStage(stage.stageNumber);
                  mutation.reset();
                }}
              >
                <span className="stage-card-top">
                  <span className="stage-badge">Stage {stage.stageNumber}</span>
                  <Tag color={stage.enabled ? 'processing' : 'default'}>{stage.enabled ? '啟用' : '停用'}</Tag>
                </span>
                <span className="stage-card-title">第 {stage.stageNumber} 階段</span>
                <span className="stage-card-meta">流水門檻 {stage.turnoverThresholdPoints.toLocaleString()} 點</span>
              </button>
            );
          })}
        </div>
        <div className="stage-reward-panel">
          <div className="stage-reward-header">
            <div>
              <Typography.Text type="secondary">該階段獎勵配置</Typography.Text>
              <Typography.Title level={4}>Stage {selectedStage} 獎項與權重</Typography.Title>
            </div>
            <Tag color="blue">總啟用權重 {totalEnabledWeight.toLocaleString()}</Tag>
          </div>
          {stagesQuery.isLoading ? (
            <div className="reward-empty">載入獎項配置中...</div>
          ) : selectedPrizes.length ? (
            <div className="reward-table-wrap">
              <table className="reward-table">
                <thead>
                  <tr>
                    <th>獎項</th>
                    <th>獎勵點數</th>
                    <th>權重</th>
                    <th>預估命中率</th>
                    <th>狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrizes.map((prize) => {
                    const hitRate =
                      prize.enabled && prize.weight > 0 && totalEnabledWeight > 0
                        ? `${((prize.weight / totalEnabledWeight) * 100).toFixed(2)}%`
                        : '0.00%';

                    return (
                      <tr key={`${selectedStage}-${prize.name}-${prize.sortOrder}`}>
                        <td>{prize.name}</td>
                        <td>{prize.amountPoints.toLocaleString()}</td>
                        <td>{prize.weight.toLocaleString()}</td>
                        <td>{hitRate}</td>
                        <td>
                          <Tag color={prize.enabled ? 'success' : 'default'}>{prize.enabled ? '啟用' : '停用'}</Tag>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="reward-empty">此階段尚未設定獎項。</div>
          )}
        </div>
        <div className="spin-action-bar">
          <div>
            <Typography.Text type="secondary">已選階段</Typography.Text>
            <Typography.Title level={4}>Stage {selectedStage}</Typography.Title>
          </div>
          <Button
            type="primary"
            size="large"
            loading={mutation.isPending}
            disabled={!selectedStageConfig?.enabled}
            onClick={() => mutation.mutate(selectedStage)}
          >
            Spin
          </Button>
        </div>
      </section>
      {stagesQuery.isError ? <Alert type="warning" showIcon message="階段設定載入失敗，暫時使用預設 5 階段顯示。" /> : null}
      {mutation.isError ? <Alert type="error" showIcon message={(mutation.error as Error).message} /> : null}
      {mutation.data ? (
        <section className="result-panel">
          <Space direction="vertical">
            <Typography.Text>Stage {mutation.data.stageNumber}</Typography.Text>
            <Typography.Title level={4}>{mutation.data.prize.name}</Typography.Title>
            <Typography.Text strong>{mutation.data.prize.amountPoints.toLocaleString()} 點</Typography.Text>
          </Space>
        </section>
      ) : null}
    </div>
  );
}
