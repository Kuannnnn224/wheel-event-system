import {
  DownloadOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Progress,
  Segmented,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useMemo, useState } from 'react';
import { defaultProbabilityConfig } from './defaultProbabilityConfig';
import {
  addDrawToSimulation,
  cloneConfig,
  createEmptySimulationResult,
  drawPrize,
  formatRate,
  getExpectedAmountPoints,
  getOverallPrizeRate,
  getPrizeWeightTotal,
  getSplitRate,
  getTableWeight,
  getValidationErrors,
  normalizeProbabilityConfig,
} from './probability';
import type { DrawMode, DrawResult, ProbabilityConfig, ProbabilityTable, PrizeConfig, SimulationResult } from './types';
import { buildConfigDiff, parseProbabilityZipFile, type ProbabilityImportDiffItem } from './zipImport';

const STORAGE_KEY = 'wheel-pm-probability-config-v1';
const simulationCountOptions = [10_000, 100_000, 1_000_000];
const drawModeOptions: Array<{ label: string; value: DrawMode }> = [
  { label: 'Low/High', value: 'split' },
  { label: 'Low', value: 'low' },
  { label: 'High', value: 'high' },
  { label: '指定派獎', value: 'prize' },
  { label: 'DailyLimit', value: 'dailyLimit' },
];

interface LocalWritableFileStream {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface LocalFileHandle {
  createWritable(): Promise<LocalWritableFileStream>;
}

interface LocalDirectoryHandle {
  name: string;
  getFileHandle(name: string, options: { create: boolean }): Promise<LocalFileHandle>;
}

interface ZipImportPreview {
  filename: string;
  fileSize: number;
  uploadedAt: string;
  zipFile: File;
  proposedConfig: ProbabilityConfig;
  diff: ProbabilityImportDiffItem[];
  savedFiles: string[];
}

function loadInitialConfig() {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return cloneConfig(defaultProbabilityConfig);
  }

  try {
    return normalizeProbabilityConfig(JSON.parse(stored));
  } catch {
    return cloneConfig(defaultProbabilityConfig);
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadText(filename: string, text: string) {
  downloadBlob(filename, new Blob([text], { type: 'application/json;charset=utf-8' }));
}

function createConfigJson(config: ProbabilityConfig) {
  return `${JSON.stringify(normalizeProbabilityConfig(config), null, 2)}\n`;
}

function createConfigBlob(config: ProbabilityConfig) {
  return new Blob([createConfigJson(config)], { type: 'application/json;charset=utf-8' });
}

function formatFileSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(2)} MB` : `${(size / 1024).toFixed(1)} KB`;
}

function safeFilename(filename: string) {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, '');
}

function formatDiffValue(value: string | number | null) {
  if (value === null) {
    return '-';
  }

  return typeof value === 'number' ? value.toLocaleString() : value;
}

async function saveBlobToDirectory(directory: LocalDirectoryHandle, filename: string, blob: Blob) {
  const fileHandle = await directory.getFileHandle(safeFilename(filename), { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

function getDesktopBridge() {
  return window.pmToolDesktop;
}

async function saveBlobToDesktop(filename: string, blob: Blob) {
  const desktop = getDesktopBridge();
  if (!desktop) {
    throw new Error('桌面版保存功能尚未啟用。');
  }

  return desktop.saveFile({
    filename: safeFilename(filename),
    contents: await blob.arrayBuffer(),
  });
}

async function saveTextToDesktop(filename: string, text: string) {
  const desktop = getDesktopBridge();
  if (!desktop) {
    throw new Error('桌面版保存功能尚未啟用。');
  }

  return desktop.saveFile({
    filename: safeFilename(filename),
    contents: text,
  });
}

function tableTag(table: ProbabilityTable) {
  const colorMap: Record<ProbabilityTable, string> = {
    low: 'blue',
    high: 'cyan',
    prize: 'magenta',
    dailyLimit: 'gold',
  };
  const labelMap: Record<ProbabilityTable, string> = {
    low: 'Low',
    high: 'High',
    prize: '指定派獎',
    dailyLimit: 'DailyLimit',
  };

  return <Tag color={colorMap[table]}>{labelMap[table]}</Tag>;
}

function numericInput(value: number, onChange: (value: number) => void, min = 0) {
  return (
    <InputNumber
      min={min}
      precision={0}
      value={value}
      onChange={(nextValue) => onChange(Number(nextValue ?? 0))}
    />
  );
}

export default function PmToolApp() {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [config, setConfig] = useState<ProbabilityConfig>(() => loadInitialConfig());
  const [selectedStageNumber, setSelectedStageNumber] = useState(1);
  const [drawMode, setDrawMode] = useState<DrawMode>('split');
  const [spinResult, setSpinResult] = useState<DrawResult>();
  const [spinHistory, setSpinHistory] = useState<Array<DrawResult & { id: number }>>([]);
  const [simulationCount, setSimulationCount] = useState(100_000);
  const [simulation, setSimulation] = useState<SimulationResult>();
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string>();
  const [localDirectory, setLocalDirectory] = useState<LocalDirectoryHandle>();
  const [desktopDirectory, setDesktopDirectory] = useState<PmToolDesktopDirectory>();
  const [importPreview, setImportPreview] = useState<ZipImportPreview>();
  const [importing, setImporting] = useState(false);
  const [savingFiles, setSavingFiles] = useState(false);
  const validationErrors = useMemo(() => getValidationErrors(config), [config]);
  const selectedStage = useMemo(
    () => config.stages.find((stage) => stage.stageNumber === selectedStageNumber) ?? config.stages[0],
    [config.stages, selectedStageNumber],
  );
  const selectedPrizes = useMemo(() => [...selectedStage.prizes].sort((a, b) => a.sortOrder - b.sortOrder), [selectedStage]);
  const lowPrizeTotal = getPrizeWeightTotal(selectedStage, 'low');
  const highPrizeTotal = getPrizeWeightTotal(selectedStage, 'high');
  const prizePrizeTotal = getPrizeWeightTotal(selectedStage, 'prize');
  const dailyLimitPrizeTotal = getPrizeWeightTotal(selectedStage, 'dailyLimit');
  const theoreticalAverage = getExpectedAmountPoints(selectedStage, drawMode);
  const desktopBridge = getDesktopBridge();
  const activeDirectoryName = desktopDirectory?.name ?? localDirectory?.name;
  const canSaveToDirectory = Boolean(desktopBridge || localDirectory);

  useEffect(() => {
    const desktop = getDesktopBridge();
    if (!desktop) {
      return;
    }

    let active = true;
    void desktop
      .getDataDirectory()
      .then((directory) => {
        if (active) {
          setDesktopDirectory(directory);
        }
      })
      .catch((directoryError: unknown) => {
        const directoryMessage = directoryError instanceof Error ? directoryError.message : '讀取桌面版資料夾失敗。';
        setError(directoryMessage);
      });

    return () => {
      active = false;
    };
  }, []);

  function replaceConfig(nextConfig: ProbabilityConfig) {
    setConfig(nextConfig);
    setSelectedStageNumber(1);
    setSpinResult(undefined);
    setSpinHistory([]);
    setSimulation(undefined);
    setSimulationProgress(0);
    setImportPreview(undefined);
  }

  function updateDailyLimit(value: number) {
    setConfig((current) => ({ ...current, dailyPayoutLimitPoints: value }));
  }

  function updateStageField(field: 'turnoverThresholdPoints' | 'lowTableWeight' | 'highTableWeight', value: number) {
    setConfig((current) => ({
      ...current,
      stages: current.stages.map((stage) =>
        stage.stageNumber === selectedStage.stageNumber
          ? {
              ...stage,
              [field]: value,
            }
          : stage,
      ),
    }));
  }

  function updatePrizeField<K extends keyof PrizeConfig>(rewardCode: string, field: K, value: PrizeConfig[K]) {
    setConfig((current) => ({
      ...current,
      stages: current.stages.map((stage) =>
        stage.stageNumber === selectedStage.stageNumber
          ? {
              ...stage,
              prizes: stage.prizes.map((prize) =>
                prize.rewardCode === rewardCode
                  ? {
                      ...prize,
                      [field]: value,
                    }
                  : prize,
              ),
            }
          : stage,
      ),
    }));
  }

  async function importProbabilityFile(file: File) {
    setError(undefined);
    setImporting(true);

    try {
      const lowerFilename = file.name.toLowerCase();
      if (lowerFilename.endsWith('.zip')) {
        const proposedConfig = await parseProbabilityZipFile(file);
        const preview: ZipImportPreview = {
          filename: file.name,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
          zipFile: file,
          proposedConfig,
          diff: buildConfigDiff(config, proposedConfig),
          savedFiles: [],
        };

        setImportPreview(preview);
        setSelectedStageNumber(1);
        setSimulation(undefined);
        setSimulationProgress(0);

        if (desktopBridge || localDirectory) {
          await saveImportPreviewFiles(preview, localDirectory);
        }

        messageApi.success(`已解析 ${file.name}`);
        return;
      }

      const nextConfig = normalizeProbabilityConfig(JSON.parse(await file.text()));
      replaceConfig(nextConfig);
      messageApi.success(`已載入 ${file.name}`);
    } catch (importError) {
      const importMessage = importError instanceof Error ? importError.message : '匯入機率表失敗。';
      setError(importMessage);
      messageApi.error(importMessage);
    } finally {
      setImporting(false);
    }
  }

  async function chooseLocalDirectory() {
    const desktop = getDesktopBridge();

    if (desktop) {
      try {
        const directory = await desktop.chooseDataDirectory();
        if (!directory) {
          return;
        }

        setDesktopDirectory(directory);
        messageApi.success(`已選擇資料夾：${directory.path}`);

        if (importPreview) {
          await saveImportPreviewFiles(importPreview);
        }
      } catch (directoryError) {
        const directoryMessage = directoryError instanceof Error ? directoryError.message : '選擇本機資料夾失敗。';
        setError(directoryMessage);
        messageApi.error(directoryMessage);
      }

      return;
    }

    const picker = (window as Window & {
      showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<LocalDirectoryHandle>;
    }).showDirectoryPicker;

    if (!picker) {
      const unsupportedMessage = '這個瀏覽器不支援直接選擇本機資料夾，請用 Chrome 或 Edge。';
      setError(unsupportedMessage);
      messageApi.warning(unsupportedMessage);
      return;
    }

    try {
      const directory = await picker({ mode: 'readwrite' });
      setLocalDirectory(directory);
      messageApi.success(`已選擇資料夾：${directory.name}`);

      if (importPreview) {
        await saveImportPreviewFiles(importPreview, directory);
      }
    } catch (directoryError) {
      if (directoryError instanceof DOMException && directoryError.name === 'AbortError') {
        return;
      }

      const directoryMessage = directoryError instanceof Error ? directoryError.message : '選擇本機資料夾失敗。';
      setError(directoryMessage);
      messageApi.error(directoryMessage);
    }
  }

  async function saveImportPreviewFiles(preview = importPreview, directory = localDirectory) {
    const desktop = getDesktopBridge();

    if (!preview || (!desktop && !directory)) {
      return;
    }

    setSavingFiles(true);
    try {
      const basename = safeFilename(stripExtension(preview.filename));
      const zipFilename = `${basename}-${new Date(preview.uploadedAt).toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}.zip`;
      const jsonFilename = `${basename}-probability.json`;

      let savedFiles: string[];
      let savedDirectoryName: string;

      if (desktop) {
        const [savedZip, savedJson] = await Promise.all([
          saveBlobToDesktop(zipFilename, preview.zipFile),
          saveTextToDesktop(jsonFilename, createConfigJson(preview.proposedConfig)),
        ]);
        setDesktopDirectory(savedZip.directory);
        savedFiles = [savedZip.filename, savedJson.filename];
        savedDirectoryName = savedZip.directory.path;
      } else if (directory) {
        await saveBlobToDirectory(directory, zipFilename, preview.zipFile);
        await saveBlobToDirectory(directory, jsonFilename, createConfigBlob(preview.proposedConfig));
        savedFiles = [zipFilename, jsonFilename];
        savedDirectoryName = directory.name;
      } else {
        return;
      }

      setImportPreview((current) => {
        if (!current || current.uploadedAt === preview.uploadedAt) {
          return { ...preview, savedFiles };
        }

        return current;
      });
      messageApi.success(`已保存到 ${savedDirectoryName}`);
    } catch (saveError) {
      const saveMessage = saveError instanceof Error ? saveError.message : '保存檔案到本機資料夾失敗。';
      setError(saveMessage);
      messageApi.error(saveMessage);
    } finally {
      setSavingFiles(false);
    }
  }

  function applyImportPreview() {
    if (!importPreview) {
      return;
    }

    replaceConfig(importPreview.proposedConfig);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(importPreview.proposedConfig));
    messageApi.success(`已套用 ${importPreview.filename}`);
  }

  async function downloadImportZip() {
    if (!importPreview) {
      return;
    }

    const desktop = getDesktopBridge();
    if (desktop) {
      try {
        const savedZip = await saveBlobToDesktop(importPreview.filename, importPreview.zipFile);
        setDesktopDirectory(savedZip.directory);
        messageApi.success(`已保存 ZIP：${savedZip.filename}`);
      } catch (downloadError) {
        const downloadMessage = downloadError instanceof Error ? downloadError.message : '保存 ZIP 失敗。';
        setError(downloadMessage);
        messageApi.error(downloadMessage);
      }

      return;
    }

    downloadBlob(importPreview.filename, importPreview.zipFile);
    messageApi.success(`已開始下載 ${importPreview.filename}`);
  }

  async function exportConfig() {
    setError(undefined);

    try {
      const normalizedConfig = normalizeProbabilityConfig(config);
      const filename = `probability-${new Date().toISOString().slice(0, 10)}.json`;
      const desktop = getDesktopBridge();

      if (desktop) {
        const savedJson = await saveTextToDesktop(filename, createConfigJson(normalizedConfig));
        setDesktopDirectory(savedJson.directory);
        messageApi.success(`已保存 ${savedJson.filename}`);
        return;
      }

      if (localDirectory) {
        await saveBlobToDirectory(localDirectory, filename, createConfigBlob(normalizedConfig));
        messageApi.success(`已保存 ${filename}`);
        return;
      }

      downloadText(filename, createConfigJson(normalizedConfig));
      messageApi.success('已下載 JSON');
    } catch (exportError) {
      const exportMessage = exportError instanceof Error ? exportError.message : '匯出機率表失敗。';
      setError(exportMessage);
      messageApi.error(exportMessage);
    }
  }

  function saveDraft() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    messageApi.success('已保存草稿');
  }

  function resetConfig() {
    window.localStorage.removeItem(STORAGE_KEY);
    replaceConfig(cloneConfig(defaultProbabilityConfig));
    messageApi.success('已還原預設機率');
  }

  function spinOnce() {
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setError(undefined);
    const result = drawPrize(selectedStage, drawMode);
    setSpinResult(result);
    setSpinHistory((current) => [{ ...result, id: Date.now() }, ...current].slice(0, 8));
  }

  async function startSimulation() {
    if (validationErrors.length > 0) {
      setError(validationErrors[0]);
      return;
    }

    setError(undefined);
    setSimulating(true);
    setSimulationProgress(0);
    const result = createEmptySimulationResult();
    const startedAt = performance.now();
    const chunkSize = 50_000;

    try {
      for (let completed = 0; completed < simulationCount; ) {
        const limit = Math.min(chunkSize, simulationCount - completed);

        for (let index = 0; index < limit; index += 1) {
          addDrawToSimulation(result, drawPrize(selectedStage, drawMode));
        }

        completed += limit;
        result.elapsedMs = Math.round(performance.now() - startedAt);
        setSimulation({
          ...result,
          tableCounts: { ...result.tableCounts },
          prizes: result.prizes.map((prize) => ({ ...prize })),
        });
        setSimulationProgress(Math.floor((completed / simulationCount) * 100));
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }

      messageApi.success('模擬完成');
    } catch (simulationError) {
      const simulationMessage = simulationError instanceof Error ? simulationError.message : '模擬失敗。';
      setError(simulationMessage);
      messageApi.error(simulationMessage);
    } finally {
      setSimulating(false);
    }
  }

  const prizeColumns: ColumnsType<PrizeConfig> = [
    {
      title: '代碼',
      dataIndex: 'rewardCode',
      width: 76,
      fixed: 'left',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '獎項',
      dataIndex: 'name',
      width: 148,
      render: (value: string, row) => (
        <Input value={value} onChange={(event) => updatePrizeField(row.rewardCode, 'name', event.target.value)} />
      ),
    },
    {
      title: '點數',
      dataIndex: 'amountPoints',
      width: 132,
      render: (value: number, row) => numericInput(value, (nextValue) => updatePrizeField(row.rewardCode, 'amountPoints', nextValue)),
    },
    {
      title: 'Low 權重',
      dataIndex: 'lowWeight',
      width: 122,
      render: (value: number, row) => numericInput(value, (nextValue) => updatePrizeField(row.rewardCode, 'lowWeight', nextValue)),
    },
    {
      title: 'Low 率',
      width: 100,
      render: (_, row) => formatRate(row.lowWeight, lowPrizeTotal),
    },
    {
      title: 'High 權重',
      dataIndex: 'highWeight',
      width: 122,
      render: (value: number, row) => numericInput(value, (nextValue) => updatePrizeField(row.rewardCode, 'highWeight', nextValue)),
    },
    {
      title: 'High 率',
      width: 100,
      render: (_, row) => formatRate(row.highWeight, highPrizeTotal),
    },
    {
      title: '綜合率',
      width: 104,
      render: (_, row) => formatRate(getOverallPrizeRate(selectedStage, row), 1),
    },
    {
      title: '指定派獎權重',
      dataIndex: 'prizeWeight',
      width: 138,
      render: (value: number, row) => numericInput(value, (nextValue) => updatePrizeField(row.rewardCode, 'prizeWeight', nextValue)),
    },
    {
      title: '指定派獎率',
      width: 112,
      render: (_, row) => formatRate(row.prizeWeight, prizePrizeTotal),
    },
    {
      title: 'DailyLimit 權重',
      dataIndex: 'dailyLimitWeight',
      width: 146,
      render: (value: number, row) =>
        numericInput(value, (nextValue) => updatePrizeField(row.rewardCode, 'dailyLimitWeight', nextValue)),
    },
    {
      title: 'DailyLimit 率',
      width: 120,
      render: (_, row) => formatRate(row.dailyLimitWeight, dailyLimitPrizeTotal),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      width: 104,
      render: (value: number, row) => numericInput(value, (nextValue) => updatePrizeField(row.rewardCode, 'sortOrder', nextValue)),
    },
  ];

  const simulationColumns: ColumnsType<SimulationResult['prizes'][number]> = [
    {
      title: '代碼',
      dataIndex: 'rewardCode',
      width: 76,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { title: '獎項', dataIndex: 'name' },
    {
      title: '單次點數',
      dataIndex: 'amountPoints',
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '命中次數',
      dataIndex: 'count',
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '命中率',
      render: (_, row) => formatRate(row.count, simulation?.count ?? 0, 4),
    },
    {
      title: '總點數',
      dataIndex: 'totalAmountPoints',
      render: (value: number) => value.toLocaleString(),
    },
  ];

  const importDiffColumns: ColumnsType<ProbabilityImportDiffItem> = [
    {
      title: '項目',
      dataIndex: 'label',
    },
    {
      title: '目前設定',
      dataIndex: 'before',
      width: 180,
      render: formatDiffValue,
    },
    {
      title: '上傳設定',
      dataIndex: 'after',
      width: 180,
      render: formatDiffValue,
    },
  ];

  return (
    <div className="pm-tool-shell">
      {messageContextHolder}
      <header className="pm-tool-header">
        <div>
          <Typography.Text className="pm-tool-kicker">Wheel Event</Typography.Text>
          <Typography.Title level={2}>PM 機率工具</Typography.Title>
        </div>
        <Space wrap>
          <Upload
            accept=".zip,.json,application/json,application/zip,application/x-zip-compressed"
            maxCount={1}
            showUploadList={false}
            beforeUpload={(file) => {
              void importProbabilityFile(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={importing}>匯入 ZIP / JSON</Button>
          </Upload>
          <Button icon={<FolderOpenOutlined />} onClick={() => void chooseLocalDirectory()}>
            {activeDirectoryName ?? '本機資料夾'}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportConfig}>
            {canSaveToDirectory ? '保存 JSON' : '下載 JSON'}
          </Button>
          <Button icon={<SaveOutlined />} onClick={saveDraft}>
            保存草稿
          </Button>
          <Button icon={<ReloadOutlined />} onClick={resetConfig}>
            還原預設
          </Button>
        </Space>
      </header>

      <main className="pm-tool-main">
        {error ? <Alert type="error" showIcon message={error} /> : null}
        {validationErrors.length ? <Alert type="warning" showIcon message={validationErrors[0]} /> : null}

        {importPreview ? (
          <section className="pm-section pm-import-section">
            <div className="pm-section-header">
              <div>
                <Typography.Text type="secondary">
                  {formatFileSize(importPreview.fileSize)} / {new Date(importPreview.uploadedAt).toLocaleString()}
                </Typography.Text>
                <Typography.Title level={4}>{importPreview.filename}</Typography.Title>
              </div>
              <Space wrap>
                <Tag color={importPreview.diff.length ? 'orange' : 'green'}>
                  {importPreview.diff.length ? `${importPreview.diff.length} 筆差異` : '無差異'}
                </Tag>
                {activeDirectoryName ? <Tag color="blue">保存資料夾 {activeDirectoryName}</Tag> : null}
                <Button icon={<DownloadOutlined />} onClick={() => void downloadImportZip()}>
                  {desktopBridge ? '保存原始 ZIP' : '下載原始 ZIP'}
                </Button>
                <Button
                  icon={<SaveOutlined />}
                  loading={savingFiles}
                  disabled={!canSaveToDirectory}
                  onClick={() => void saveImportPreviewFiles()}
                >
                  保存 ZIP / JSON
                </Button>
                <Button type="primary" onClick={applyImportPreview}>
                  套用這份機率表
                </Button>
              </Space>
            </div>
            {importPreview.savedFiles.length ? (
              <Alert
                type="success"
                showIcon
                message={`已保存：${importPreview.savedFiles.join('、')}`}
                className="pm-inline-alert"
              />
            ) : null}
            {importPreview.diff.length ? (
              <Table
                rowKey={(row) => row.key}
                dataSource={importPreview.diff}
                columns={importDiffColumns}
                pagination={{ pageSize: 6, showSizeChanger: false }}
              />
            ) : (
              <Alert type="success" showIcon message="這份 ZIP 與目前設定沒有差異。" />
            )}
          </section>
        ) : null}

        <section className="pm-section pm-stage-section">
          <div className="pm-section-header">
            <div>
              <Typography.Text type="secondary">目前檢視</Typography.Text>
              <Typography.Title level={4}>Stage {selectedStage.stageNumber}</Typography.Title>
            </div>
            <Space wrap>
              <Tag color="blue">Low {selectedStage.lowTableWeight.toLocaleString()} / {formatRate(getSplitRate(selectedStage, 'low'))}</Tag>
              <Tag color="cyan">High {selectedStage.highTableWeight.toLocaleString()} / {formatRate(getSplitRate(selectedStage, 'high'))}</Tag>
              <Tag color={config.dailyPayoutLimitPoints > 0 ? 'gold' : 'default'}>
                每日上限 {config.dailyPayoutLimitPoints > 0 ? `${config.dailyPayoutLimitPoints.toLocaleString()} 點` : '停用'}
              </Tag>
            </Space>
          </div>

          <div className="pm-stage-grid">
            {config.stages.map((stage) => (
              <button
                key={stage.stageNumber}
                type="button"
                className={`pm-stage-card ${stage.stageNumber === selectedStage.stageNumber ? 'is-selected' : ''}`}
                onClick={() => setSelectedStageNumber(stage.stageNumber)}
              >
                <span className="pm-stage-card-top">
                  <span>Stage {stage.stageNumber}</span>
                  <span>{formatRate(getSplitRate(stage, 'high'))}</span>
                </span>
                <strong>第 {stage.stageNumber} 階段</strong>
                <span>流水 {stage.turnoverThresholdPoints.toLocaleString()} 點</span>
              </button>
            ))}
          </div>
        </section>

        <section className="pm-section">
          <div className="pm-section-header">
            <div>
              <Typography.Text type="secondary">Stage {selectedStage.stageNumber}</Typography.Text>
              <Typography.Title level={4}>分流與門檻</Typography.Title>
            </div>
          </div>
          <div className="pm-field-grid">
            <label>
              <span>流水門檻</span>
              {numericInput(selectedStage.turnoverThresholdPoints, (value) => updateStageField('turnoverThresholdPoints', value))}
            </label>
            <label>
              <span>Low 分流權重</span>
              {numericInput(selectedStage.lowTableWeight, (value) => updateStageField('lowTableWeight', value))}
            </label>
            <label>
              <span>High 分流權重</span>
              {numericInput(selectedStage.highTableWeight, (value) => updateStageField('highTableWeight', value))}
            </label>
            <label>
              <span>每日送出上限</span>
              {numericInput(config.dailyPayoutLimitPoints, updateDailyLimit)}
            </label>
          </div>
        </section>

        <section className="pm-section">
          <div className="pm-section-header">
            <div>
              <Typography.Text type="secondary">Stage {selectedStage.stageNumber}</Typography.Text>
              <Typography.Title level={4}>獎項權重</Typography.Title>
            </div>
            <Space wrap>
              <Tag>Low 合計 {lowPrizeTotal.toLocaleString()}</Tag>
              <Tag>High 合計 {highPrizeTotal.toLocaleString()}</Tag>
              <Tag color="magenta">指定派獎合計 {prizePrizeTotal.toLocaleString()}</Tag>
              <Tag color="gold">DailyLimit 合計 {dailyLimitPrizeTotal.toLocaleString()}</Tag>
            </Space>
          </div>
          <Table
            rowKey={(row) => row.rewardCode}
            dataSource={selectedPrizes}
            columns={prizeColumns}
            pagination={false}
            scroll={{ x: 1450 }}
          />
        </section>

        <div className="pm-tool-grid">
          <section className="pm-section pm-spin-section">
            <div className="pm-section-header">
              <div>
                <Typography.Text type="secondary">Stage {selectedStage.stageNumber}</Typography.Text>
                <Typography.Title level={4}>模擬抽獎</Typography.Title>
              </div>
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={spinOnce} disabled={validationErrors.length > 0}>
                Spin
              </Button>
            </div>
            <Segmented
              block
              options={drawModeOptions}
              value={drawMode}
              onChange={(value) => setDrawMode(value as DrawMode)}
            />
            <div className="pm-spin-result">
              {spinResult ? (
                <>
                  {tableTag(spinResult.table)}
                  <Tag>{spinResult.prize.rewardCode} 獎</Tag>
                  <strong>{spinResult.prize.name}</strong>
                  <span>{spinResult.prize.amountPoints.toLocaleString()} 點</span>
                </>
              ) : (
                <span className="pm-muted">尚無抽獎結果</span>
              )}
            </div>
            <div className="pm-history-list">
              {spinHistory.map((item) => (
                <div key={item.id} className="pm-history-row">
                  {tableTag(item.table)}
                  <span>{item.prize.rewardCode}</span>
                  <strong>{item.prize.name}</strong>
                  <span>{item.prize.amountPoints.toLocaleString()} 點</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pm-section pm-simulation-section">
            <div className="pm-section-header">
              <div>
                <Typography.Text type="secondary">理論平均 {theoreticalAverage.toLocaleString(undefined, { maximumFractionDigits: 4 })} 點</Typography.Text>
                <Typography.Title level={4}>模擬統計</Typography.Title>
              </div>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                loading={simulating}
                disabled={validationErrors.length > 0}
                onClick={() => void startSimulation()}
              >
                開始模擬
              </Button>
            </div>
            <div className="pm-simulation-controls">
              <Segmented
                options={simulationCountOptions.map((value) => ({ label: value.toLocaleString(), value }))}
                value={simulationCount}
                onChange={(value) => setSimulationCount(Number(value))}
              />
              <InputNumber
                min={1}
                max={5_000_000}
                precision={0}
                value={simulationCount}
                onChange={(value) => setSimulationCount(Number(value ?? 1))}
              />
            </div>
            <Progress percent={simulationProgress} status={simulating ? 'active' : undefined} />
            <div className="pm-metric-grid">
              <div className="pm-metric">
                <span>總次數</span>
                <strong>{(simulation?.count ?? 0).toLocaleString()}</strong>
              </div>
              <div className="pm-metric">
                <span>平均點數</span>
                <strong>{(simulation?.averageAmountPoints ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong>
              </div>
              <div className="pm-metric">
                <span>總送出</span>
                <strong>{(simulation?.totalAmountPoints ?? 0).toLocaleString()}</strong>
              </div>
              <div className="pm-metric">
                <span>耗時</span>
                <strong>{simulation?.elapsedMs ? `${simulation.elapsedMs.toLocaleString()} ms` : '-'}</strong>
              </div>
            </div>
            <div className="pm-table-counts">
              {(['low', 'high', 'prize', 'dailyLimit'] as ProbabilityTable[]).map((table) => {
                const count = simulation?.tableCounts[table] ?? 0;
                return (
                  <span key={table}>
                    {tableTag(table)}
                    {count.toLocaleString()} / {formatRate(count, simulation?.count ?? 0, 4)}
                  </span>
                );
              })}
            </div>
          </section>
        </div>

        {simulation ? (
          <section className="pm-section">
            <div className="pm-section-header">
              <div>
                <Typography.Text type="secondary">Stage {selectedStage.stageNumber}</Typography.Text>
                <Typography.Title level={4}>模擬結果</Typography.Title>
              </div>
            </div>
            <Table
              rowKey={(row) => `${row.rewardCode}-${row.name}-${row.amountPoints}`}
              dataSource={simulation.prizes}
              columns={simulationColumns}
              pagination={false}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}
