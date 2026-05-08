import { Alert, Button, Form, Input, InputNumber, Space, Switch, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { fetchStages, saveStages } from '../api/client';
import type { PrizeConfig, StageConfig } from '../api/types';

function cloneStages(stages: StageConfig[]) {
  return stages.map((stage) => ({
    ...stage,
    prizes: stage.prizes.map((prize) => ({ ...prize })),
  }));
}

export default function ProbabilitySettingsPage() {
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const currentStage = stages.find((stage) => stage.stageNumber === selectedStage);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      setStages(await fetchStages());
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入機率設定失敗');
    } finally {
      setLoading(false);
    }
  }

  function patchStage(stageNumber: number, patch: Partial<StageConfig>) {
    setStages((previous) =>
      previous.map((stage) => (stage.stageNumber === stageNumber ? { ...stage, ...patch } : stage)),
    );
  }

  function patchPrize(rewardCode: string, patch: Partial<PrizeConfig>) {
    setStages((previous) =>
      previous.map((stage) => {
        if (stage.stageNumber !== selectedStage) {
          return stage;
        }

        const prizes = stage.prizes.map((prize) => (prize.rewardCode === rewardCode ? { ...prize, ...patch } : prize));
        return { ...stage, prizes };
      }),
    );
  }

  async function submit() {
    setLoading(true);
    setError(undefined);
    try {
      setStages(await saveStages(cloneStages(stages)));
    } catch (err) {
      setError(err instanceof Error ? err.message : '儲存機率設定失敗');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack">
      <Typography.Title level={3}>機率 / 獎項設定</Typography.Title>
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Space wrap>
        {stages.map((stage) => (
          <Button
            key={stage.stageNumber}
            type={stage.stageNumber === selectedStage ? 'primary' : 'default'}
            onClick={() => setSelectedStage(stage.stageNumber)}
          >
            Stage {stage.stageNumber}
          </Button>
        ))}
        <Button onClick={load} loading={loading}>
          重新載入
        </Button>
        <Button type="primary" onClick={submit} loading={loading}>
          儲存全部
        </Button>
      </Space>
      {currentStage ? (
        <>
          <Form layout="inline">
            <Form.Item label="流水門檻">
              <InputNumber
                min={0}
                precision={0}
                value={currentStage.turnoverThresholdPoints}
                onChange={(value) => patchStage(currentStage.stageNumber, { turnoverThresholdPoints: Number(value ?? 0) })}
              />
            </Form.Item>
            <Form.Item label="Low 表分流權重">
              <InputNumber
                min={0}
                precision={0}
                value={currentStage.lowTableWeight}
                onChange={(value) => patchStage(currentStage.stageNumber, { lowTableWeight: Number(value ?? 0) })}
              />
            </Form.Item>
            <Form.Item label="High 表分流權重">
              <InputNumber
                min={0}
                precision={0}
                value={currentStage.highTableWeight}
                onChange={(value) => patchStage(currentStage.stageNumber, { highTableWeight: Number(value ?? 0) })}
              />
            </Form.Item>
            <Form.Item label="啟用">
              <Switch
                checked={currentStage.enabled}
                onChange={(enabled) => patchStage(currentStage.stageNumber, { enabled })}
              />
            </Form.Item>
          </Form>
          <Table<PrizeConfig>
            rowKey={(_, index) => `${selectedStage}-${index}`}
            dataSource={[...currentStage.prizes].sort((a, b) => a.sortOrder - b.sortOrder)}
            pagination={false}
            columns={[
              {
                title: '代碼',
                dataIndex: 'rewardCode',
                render: (value: string) => <Tag>{value}</Tag>,
              },
              {
                title: '獎項',
                dataIndex: 'name',
                render: (value: string, row) => <Input value={value} onChange={(event) => patchPrize(row.rewardCode, { name: event.target.value })} />,
              },
              {
                title: 'Low 權重',
                dataIndex: 'lowWeight',
                render: (value: number, row) => (
                  <InputNumber min={0} precision={0} value={value} onChange={(next) => patchPrize(row.rewardCode, { lowWeight: Number(next ?? 0) })} />
                ),
              },
              {
                title: 'High 權重',
                dataIndex: 'highWeight',
                render: (value: number, row) => (
                  <InputNumber min={0} precision={0} value={value} onChange={(next) => patchPrize(row.rewardCode, { highWeight: Number(next ?? 0) })} />
                ),
              },
              {
                title: '點數',
                dataIndex: 'amountPoints',
                render: (value: number, row) => (
                  <InputNumber
                    min={0}
                    precision={0}
                    value={value}
                    onChange={(next) => patchPrize(row.rewardCode, { amountPoints: Number(next ?? 0) })}
                  />
                ),
              },
              {
                title: '啟用',
                dataIndex: 'enabled',
                render: (value: boolean, row) => <Switch checked={value} onChange={(enabled) => patchPrize(row.rewardCode, { enabled })} />,
              },
              {
                title: '排序',
                dataIndex: 'sortOrder',
                render: (value: number, row) => (
                  <InputNumber min={0} precision={0} value={value} onChange={(next) => patchPrize(row.rewardCode, { sortOrder: Number(next ?? 0) })} />
                ),
              },
            ]}
          />
        </>
      ) : null}
    </div>
  );
}
