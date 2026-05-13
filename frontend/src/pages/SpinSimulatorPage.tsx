import { Alert, Button, Space, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { api, fetchStages } from '../api/client';
import type { ProbabilityTable, StageConfig } from '../api/types';
import ProbabilityTableTag from '../components/ProbabilityTableTag';

interface SimulateResult {
  stageNumber: number;
  probabilityTable: ProbabilityTable;
  prize: {
    id?: number;
    rewardCode: string;
    name: string;
    amountPoints: number;
  };
}

const fallbackStages: StageConfig[] = Array.from({ length: 5 }, (_, index) => ({
  stageNumber: index + 1,
  turnoverThresholdPoints: 0,
  lowTableWeight: 80,
  highTableWeight: 20,
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
  const lowEnabledWeight = selectedPrizes
    .filter((prize) => prize.lowWeight > 0)
    .reduce((sum, prize) => sum + prize.lowWeight, 0);
  const highEnabledWeight = selectedPrizes
    .filter((prize) => prize.highWeight > 0)
    .reduce((sum, prize) => sum + prize.highWeight, 0);
  const dailyLimitEnabledWeight = selectedPrizes
    .filter((prize) => prize.dailyLimitWeight > 0)
    .reduce((sum, prize) => sum + prize.dailyLimitWeight, 0);
  const tableSplitTotal = (selectedStageConfig?.lowTableWeight ?? 0) + (selectedStageConfig?.highTableWeight ?? 0);
  const lowSplitRate = tableSplitTotal > 0 ? (((selectedStageConfig?.lowTableWeight ?? 0) / tableSplitTotal) * 100).toFixed(2) : '0.00';
  const highSplitRate = tableSplitTotal > 0 ? (((selectedStageConfig?.highTableWeight ?? 0) / tableSplitTotal) * 100).toFixed(2) : '0.00';

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
                className={`stage-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => {
                  setSelectedStage(stage.stageNumber);
                  mutation.reset();
                }}
              >
                <span className="stage-card-top">
                  <span className="stage-badge">Stage {stage.stageNumber}</span>
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
            <Space wrap>
              <Tag color="blue">Low 表 {selectedStageConfig?.lowTableWeight ?? 0} / {lowSplitRate}%</Tag>
              <Tag color="cyan">High 表 {selectedStageConfig?.highTableWeight ?? 0} / {highSplitRate}%</Tag>
            </Space>
          </div>
          {stagesQuery.isLoading ? (
            <div className="reward-empty">載入獎項配置中...</div>
          ) : selectedPrizes.length ? (
            <div className="reward-table-wrap">
              <table className="reward-table">
                <thead>
                  <tr>
                    <th>代碼</th>
                    <th>獎項</th>
                    <th>獎勵點數</th>
                    <th>Low 權重</th>
                    <th>Low 命中率</th>
                    <th>High 權重</th>
                    <th>High 命中率</th>
                    <th>DailyLimit 權重</th>
                    <th>DailyLimit 命中率</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPrizes.map((prize) => {
                    const lowHitRate =
                      prize.lowWeight > 0 && lowEnabledWeight > 0
                        ? `${((prize.lowWeight / lowEnabledWeight) * 100).toFixed(2)}%`
                        : '0.00%';
                    const highHitRate =
                      prize.highWeight > 0 && highEnabledWeight > 0
                        ? `${((prize.highWeight / highEnabledWeight) * 100).toFixed(2)}%`
                        : '0.00%';
                    const dailyLimitHitRate =
                      prize.dailyLimitWeight > 0 && dailyLimitEnabledWeight > 0
                        ? `${((prize.dailyLimitWeight / dailyLimitEnabledWeight) * 100).toFixed(2)}%`
                        : '0.00%';

                    return (
                      <tr key={`${selectedStage}-${prize.rewardCode}-${prize.sortOrder}`}>
                        <td>
                          <Tag>{prize.rewardCode}</Tag>
                        </td>
                        <td>{prize.name}</td>
                        <td>{prize.amountPoints.toLocaleString()}</td>
                        <td>{prize.lowWeight.toLocaleString()}</td>
                        <td>{lowHitRate}</td>
                        <td>{prize.highWeight.toLocaleString()}</td>
                        <td>{highHitRate}</td>
                        <td>{prize.dailyLimitWeight.toLocaleString()}</td>
                        <td>{dailyLimitHitRate}</td>
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
          <div className="spin-selection-summary">
            <div>
              <Typography.Text type="secondary">已選階段</Typography.Text>
              <Typography.Title level={4}>Stage {selectedStage}</Typography.Title>
            </div>
            {mutation.data ? (
              <div className="inline-spin-result">
                <Typography.Text type="secondary">本次結果</Typography.Text>
                <div className="inline-spin-result-main">
                  <ProbabilityTableTag value={mutation.data.probabilityTable} suffix=" 表" />
                  <Tag>{mutation.data.prize.rewardCode} 獎</Tag>
                  <Typography.Text strong>{mutation.data.prize.name}</Typography.Text>
                  <Typography.Text>{mutation.data.prize.amountPoints.toLocaleString()} 點</Typography.Text>
                </div>
              </div>
            ) : null}
          </div>
          <Button
            type="primary"
            size="large"
            loading={mutation.isPending}
            disabled={!selectedStageConfig}
            onClick={() => mutation.mutate(selectedStage)}
          >
            Spin
          </Button>
        </div>
      </section>
      {stagesQuery.isError ? <Alert type="warning" showIcon message="階段設定載入失敗，暫時使用預設 5 階段顯示。" /> : null}
      {mutation.isError ? <Alert type="error" showIcon message={(mutation.error as Error).message} /> : null}
    </div>
  );
}
