import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, InputNumber, Space, Table, Tag, Typography, Upload } from 'antd';
import { useEffect, useState } from 'react';
import {
  applyProbabilityImport,
  downloadProbabilityImport,
  fetchProbabilityImports,
  fetchStages,
  previewProbabilityImport,
  saveStages,
} from '../api/client';
import type { PrizeConfig, ProbabilityImportDiffItem, ProbabilityImportPreview, ProbabilityImportUpload, StageConfig } from '../api/types';

function cloneStages(stages: StageConfig[]) {
  return stages.map((stage) => ({
    ...stage,
    prizes: stage.prizes.map((prize) => ({ ...prize })),
  }));
}

export default function ProbabilitySettingsPage() {
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [imports, setImports] = useState<ProbabilityImportUpload[]>([]);
  const [importPreview, setImportPreview] = useState<ProbabilityImportPreview>();
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const currentStage = stages.find((stage) => stage.stageNumber === selectedStage);

  useEffect(() => {
    void load();
    void loadImports();
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

  async function loadImports() {
    try {
      setImports(await fetchProbabilityImports());
    } catch {
      setImports([]);
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

  async function previewImport(file: File) {
    setImportLoading(true);
    setImportPreview(undefined);
    setError(undefined);
    try {
      const preview = await previewProbabilityImport(file);
      setImportPreview(preview);
      await loadImports();
    } catch (err) {
      setError(err instanceof Error ? err.message : '匯入機率表失敗');
    } finally {
      setImportLoading(false);
    }
  }

  async function applyImport() {
    if (!importPreview) {
      return;
    }

    setApplyLoading(true);
    setError(undefined);
    try {
      const result = await applyProbabilityImport(importPreview.upload.id);
      setStages(result.stages);
      setSelectedStage(1);
      setImportPreview(undefined);
      await loadImports();
    } catch (err) {
      setError(err instanceof Error ? err.message : '套用機率表失敗');
    } finally {
      setApplyLoading(false);
    }
  }

  function formatDiffValue(value: string | number | null) {
    if (value === null) {
      return '-';
    }

    return typeof value === 'number' ? value.toLocaleString() : value;
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
        <Upload
          accept=".zip"
          maxCount={1}
          showUploadList={false}
          beforeUpload={(file) => {
            void previewImport(file);
            return false;
          }}
        >
          <Button icon={<UploadOutlined />} loading={importLoading}>
            上傳機率表 ZIP
          </Button>
        </Upload>
      </Space>
      {importPreview ? (
        <section className="import-preview-panel">
          <div className="import-preview-header">
            <div>
              <Typography.Text type="secondary">已保存上傳檔</Typography.Text>
              <Typography.Title level={4}>{importPreview.upload.originalFilename}</Typography.Title>
            </div>
            <Space wrap>
              <Button icon={<DownloadOutlined />} onClick={() => void downloadProbabilityImport(importPreview.upload)}>
                下載原始 ZIP
              </Button>
              <Button type="primary" onClick={applyImport} loading={applyLoading}>
                套用這份機率表
              </Button>
            </Space>
          </div>
          {importPreview.diff.length ? (
            <Table<ProbabilityImportDiffItem>
              rowKey="key"
              dataSource={importPreview.diff}
              pagination={{ pageSize: 8, showSizeChanger: false }}
              columns={[
                {
                  title: '項目',
                  dataIndex: 'label',
                },
                {
                  title: '目前設定',
                  dataIndex: 'before',
                  render: formatDiffValue,
                },
                {
                  title: '上傳設定',
                  dataIndex: 'after',
                  render: formatDiffValue,
                },
              ]}
            />
          ) : (
            <Alert type="success" showIcon message="這份機率表與目前設定沒有差異。" />
          )}
        </section>
      ) : null}
      {imports.length ? (
        <section className="import-history-panel">
          <div className="import-history-header">
            <Typography.Text type="secondary">已保存 ZIP</Typography.Text>
          </div>
          <Table<ProbabilityImportUpload>
            rowKey="id"
            size="small"
            dataSource={imports.slice(0, 5)}
            pagination={false}
            columns={[
              {
                title: '檔名',
                dataIndex: 'originalFilename',
              },
              {
                title: '上傳時間',
                dataIndex: 'uploadedAt',
                render: (value: string) => new Date(value).toLocaleString(),
              },
              {
                title: '大小',
                dataIndex: 'fileSize',
                render: (value: number) => `${(value / 1024).toFixed(1)} KB`,
              },
              {
                title: '',
                render: (_, upload) => (
                  <Button icon={<DownloadOutlined />} onClick={() => void downloadProbabilityImport(upload)}>
                    下載
                  </Button>
                ),
              },
            ]}
          />
        </section>
      ) : null}
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
