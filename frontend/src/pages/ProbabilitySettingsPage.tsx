import { DownOutlined, DownloadOutlined, ReloadOutlined, RightOutlined, UploadOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input, InputNumber, Space, Table, Tag, Typography, Upload, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import {
  applyProbabilityImport,
  downloadProbabilityImport,
  fetchProbabilityConfig,
  fetchProbabilityImports,
  previewProbabilityImport,
} from '../api/client';
import type { PrizeConfig, ProbabilityImportDiffItem, ProbabilityImportPreview, ProbabilityImportUpload, StageConfig } from '../api/types';

function formatWeightRate(weight: number, total: number) {
  return total > 0 ? `${((weight / total) * 100).toFixed(2)}%` : '0.00%';
}

export default function ProbabilitySettingsPage() {
  const [stages, setStages] = useState<StageConfig[]>([]);
  const [dailyPayoutLimitPoints, setDailyPayoutLimitPoints] = useState(0);
  const [imports, setImports] = useState<ProbabilityImportUpload[]>([]);
  const [importPreview, setImportPreview] = useState<ProbabilityImportPreview>();
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [downloadingImportId, setDownloadingImportId] = useState<string>();
  const [downloadNotice, setDownloadNotice] = useState<string>();
  const [isImportHistoryOpen, setIsImportHistoryOpen] = useState(false);
  const [messageApi, messageContextHolder] = message.useMessage();
  const currentStage = stages.find((stage) => stage.stageNumber === selectedStage);
  const currentPrizes = useMemo(
    () => [...(currentStage?.prizes ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
    [currentStage?.prizes],
  );
  const currentSplitTotal = (currentStage?.lowTableWeight ?? 0) + (currentStage?.highTableWeight ?? 0);
  const lowSplitRate = formatWeightRate(currentStage?.lowTableWeight ?? 0, currentSplitTotal);
  const highSplitRate = formatWeightRate(currentStage?.highTableWeight ?? 0, currentSplitTotal);
  const lowPrizeWeightTotal = currentPrizes.reduce((sum, prize) => sum + prize.lowWeight, 0);
  const highPrizeWeightTotal = currentPrizes.reduce((sum, prize) => sum + prize.highWeight, 0);
  const prizePrizeWeightTotal = currentPrizes.reduce((sum, prize) => sum + prize.prizeWeight, 0);
  const dailyLimitPrizeWeightTotal = currentPrizes.reduce((sum, prize) => sum + prize.dailyLimitWeight, 0);

  useEffect(() => {
    void load();
    void loadImports();
  }, []);

  async function load() {
    setLoading(true);
    setError(undefined);
    try {
      const config = await fetchProbabilityConfig();
      setStages(config.stages);
      setDailyPayoutLimitPoints(config.dailyPayoutLimitPoints);
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
      setDailyPayoutLimitPoints(result.dailyPayoutLimitPoints);
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

  async function downloadImport(upload: ProbabilityImportUpload) {
    setDownloadingImportId(upload.id);
    setError(undefined);
    setDownloadNotice(undefined);
    try {
      await downloadProbabilityImport(upload);
      setDownloadNotice(`已開始下載 ${upload.originalFilename}`);
      messageApi.success(`已開始下載 ${upload.originalFilename}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '下載 ZIP 失敗';
      setError(message);
      messageApi.error(message);
    } finally {
      setDownloadingImportId(undefined);
    }
  }

  return (
    <div className="page-stack">
      {messageContextHolder}
      <Typography.Title level={3}>機率 / 獎項設定</Typography.Title>
      <Alert type="info" showIcon message="機率設定為唯讀，只能透過上傳機率表 ZIP 預覽並套用更新。" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {downloadNotice ? <Alert type="success" showIcon message={downloadNotice} /> : null}
      <section className="probability-control-panel">
        <div className="probability-control-header">
          <div>
            <Typography.Text type="secondary">目前檢視</Typography.Text>
            <Typography.Title level={4}>Stage {selectedStage}</Typography.Title>
          </div>
          <Space wrap>
            <Tag color={dailyPayoutLimitPoints > 0 ? 'gold' : 'default'}>
              每日上限 {dailyPayoutLimitPoints > 0 ? `${dailyPayoutLimitPoints.toLocaleString()} 點` : '停用'}
            </Tag>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
              重新載入
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
        </div>
        <div className="probability-stage-grid">
          {stages.map((stage) => {
            const isSelected = stage.stageNumber === selectedStage;
            const splitTotal = stage.lowTableWeight + stage.highTableWeight;

            return (
              <button
                key={stage.stageNumber}
                type="button"
                className={`probability-stage-card ${isSelected ? 'is-selected' : ''}`}
                onClick={() => setSelectedStage(stage.stageNumber)}
              >
                <span className="probability-stage-card-top">
                  <span className="stage-badge">Stage {stage.stageNumber}</span>
                  <span className="probability-stage-dot" />
                </span>
                <span className="probability-stage-card-title">第 {stage.stageNumber} 階段</span>
                <span className="probability-stage-card-meta">流水 {stage.turnoverThresholdPoints.toLocaleString()} 點</span>
                <span className="probability-stage-split">
                  L {formatWeightRate(stage.lowTableWeight, splitTotal)} / H {formatWeightRate(stage.highTableWeight, splitTotal)}
                </span>
              </button>
            );
          })}
        </div>
      </section>
      {importPreview ? (
        <section className="import-preview-panel">
          <div className="import-preview-header">
            <div>
              <Typography.Text type="secondary">已保存上傳檔</Typography.Text>
              <Typography.Title level={4}>{importPreview.upload.originalFilename}</Typography.Title>
            </div>
            <Space wrap>
              <Button
                icon={<DownloadOutlined />}
                loading={downloadingImportId === importPreview.upload.id}
                onClick={() => void downloadImport(importPreview.upload)}
              >
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
          <button
            type="button"
            className="import-history-toggle"
            aria-expanded={isImportHistoryOpen}
            onClick={() => setIsImportHistoryOpen((value) => !value)}
          >
            <span className="import-history-title">
              {isImportHistoryOpen ? <DownOutlined /> : <RightOutlined />}
              <span className="import-history-title-copy">
                <span className="import-history-kicker">已保存 ZIP</span>
                <span className="import-history-heading">上傳紀錄</span>
              </span>
            </span>
            <span className="import-history-meta">{imports.length} 筆</span>
          </button>
          {isImportHistoryOpen ? (
            <div className="import-history-content">
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
                      <Button
                        icon={<DownloadOutlined />}
                        loading={downloadingImportId === upload.id}
                        onClick={() => void downloadImport(upload)}
                      >
                        下載
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          ) : null}
        </section>
      ) : null}
      {currentStage ? (
        <section className="probability-editor-panel">
          <div className="probability-section-header">
            <div>
              <Typography.Text type="secondary">Stage {currentStage.stageNumber} 基礎設定</Typography.Text>
              <Typography.Title level={4}>分流與流水門檻</Typography.Title>
            </div>
            <Space wrap>
              <Tag color="blue">Low {currentStage.lowTableWeight.toLocaleString()} / {lowSplitRate}</Tag>
              <Tag color="cyan">High {currentStage.highTableWeight.toLocaleString()} / {highSplitRate}</Tag>
            </Space>
          </div>
          <Form layout="vertical" className="probability-setting-grid">
            <Form.Item label="流水門檻">
              <InputNumber
                min={0}
                precision={0}
                value={currentStage.turnoverThresholdPoints}
                readOnly
              />
            </Form.Item>
            <Form.Item label="Low 表分流權重">
              <InputNumber
                min={0}
                precision={0}
                value={currentStage.lowTableWeight}
                readOnly
              />
            </Form.Item>
            <Form.Item label="High 表分流權重">
              <InputNumber
                min={0}
                precision={0}
                value={currentStage.highTableWeight}
                readOnly
              />
            </Form.Item>
          </Form>
        </section>
      ) : null}
      {currentStage ? (
        <section className="prize-editor-panel">
          <div className="probability-section-header">
            <div>
              <Typography.Text type="secondary">Stage {currentStage.stageNumber} 獎項設定</Typography.Text>
              <Typography.Title level={4}>A-E 獎項權重</Typography.Title>
            </div>
            <Space wrap>
              <Tag>Low 權重合計 {lowPrizeWeightTotal.toLocaleString()}</Tag>
              <Tag>High 權重合計 {highPrizeWeightTotal.toLocaleString()}</Tag>
              <Tag color="magenta">指定派獎權重合計 {prizePrizeWeightTotal.toLocaleString()}</Tag>
              <Tag color="gold">DailyLimit 權重合計 {dailyLimitPrizeWeightTotal.toLocaleString()}</Tag>
            </Space>
          </div>
          <Table<PrizeConfig>
            className="probability-prize-table"
            rowKey={(_, index) => `${selectedStage}-${index}`}
            dataSource={currentPrizes}
            pagination={false}
            columns={[
              {
                title: '代碼',
                dataIndex: 'rewardCode',
                width: 70,
                render: (value: string) => <Tag>{value}</Tag>,
              },
              {
                title: '獎項',
                dataIndex: 'name',
                render: (value: string) => <Input value={value} readOnly />,
              },
              {
                title: 'Low 權重',
                dataIndex: 'lowWeight',
                width: 132,
                render: (value: number, row) => (
                  <InputNumber min={0} precision={0} value={value} readOnly />
                ),
              },
              {
                title: 'High 權重',
                dataIndex: 'highWeight',
                width: 132,
                render: (value: number, row) => (
                  <InputNumber min={0} precision={0} value={value} readOnly />
                ),
              },
              {
                title: '指定派獎權重',
                dataIndex: 'prizeWeight',
                width: 132,
                render: (value: number | undefined, row) => (
                  <InputNumber
                    min={0}
                    precision={0}
                    value={value ?? 0}
                    readOnly
                  />
                ),
              },
              {
                title: 'DailyLimit 權重',
                dataIndex: 'dailyLimitWeight',
                width: 150,
                render: (value: number | undefined, row) => (
                  <InputNumber
                    min={0}
                    precision={0}
                    value={value ?? 0}
                    readOnly
                  />
                ),
              },
              {
                title: '點數',
                dataIndex: 'amountPoints',
                width: 132,
                render: (value: number, row) => (
                  <InputNumber
                    min={0}
                    precision={0}
                    value={value}
                    readOnly
                  />
                ),
              },
              {
                title: '排序',
                dataIndex: 'sortOrder',
                width: 118,
                render: (value: number, row) => (
                  <InputNumber min={0} precision={0} value={value} readOnly />
                ),
              },
            ]}
          />
        </section>
      ) : null}
    </div>
  );
}
