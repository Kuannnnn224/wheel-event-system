const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');

const PRODUCT_TITLE = 'PM 機率工具';
const DATA_ROOT_NAME = 'Wheel Event PM Tool';
const DATA_DIRECTORY_NAME = 'probability-files';
const SETTINGS_FILENAME = 'settings.json';

let mainWindow;

function getSettingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILENAME);
}

async function readSettings() {
  try {
    const settings = JSON.parse(await fs.readFile(getSettingsPath(), 'utf-8'));
    return settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {};
  } catch {
    return {};
  }
}

async function writeSettings(settings) {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  await fs.writeFile(getSettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, 'utf-8');
}

function getDefaultDataDirectoryPath() {
  return path.join(app.getPath('documents'), DATA_ROOT_NAME, DATA_DIRECTORY_NAME);
}

async function getConfiguredDataDirectoryPath() {
  const settings = await readSettings();

  if (typeof settings.dataDirectoryPath === 'string' && path.isAbsolute(settings.dataDirectoryPath)) {
    return settings.dataDirectoryPath;
  }

  return getDefaultDataDirectoryPath();
}

function describeDirectory(directoryPath) {
  return {
    path: directoryPath,
    name: path.basename(directoryPath),
  };
}

async function ensureDataDirectory(directoryPath = undefined) {
  const resolvedPath = directoryPath ?? (await getConfiguredDataDirectoryPath());
  await fs.mkdir(resolvedPath, { recursive: true });

  const readmePath = path.join(resolvedPath, 'README.txt');
  if (!fsSync.existsSync(readmePath)) {
    await fs.writeFile(
      readmePath,
      [
        'PM 機率工具本機保存資料夾',
        '',
        'Electron 桌面版會把上傳的 ZIP、解析後的 probability JSON、手動匯出的 JSON 存在這裡。',
        '你也可以在工具上方按「本機資料夾」改用其他資料夾。',
        '',
      ].join('\n'),
      'utf-8',
    );
  }

  return describeDirectory(resolvedPath);
}

function safeFilename(filename) {
  const basename = path.basename(String(filename || 'download.bin'));
  const cleaned = basename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim();
  return cleaned || 'download.bin';
}

function resolveDataFilePath(directoryPath, filename) {
  const safeName = safeFilename(filename);
  const basePath = path.resolve(directoryPath);
  const filePath = path.resolve(basePath, safeName);

  if (filePath !== basePath && filePath.startsWith(`${basePath}${path.sep}`)) {
    return filePath;
  }

  throw new Error('檔名不合法，無法保存。');
}

function toBuffer(contents) {
  if (typeof contents === 'string') {
    return Buffer.from(contents, 'utf-8');
  }

  if (contents instanceof ArrayBuffer) {
    return Buffer.from(contents);
  }

  if (ArrayBuffer.isView(contents)) {
    return Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength);
  }

  throw new Error('不支援的檔案內容格式。');
}

async function saveFileToDataDirectory(payload) {
  if (!payload || typeof payload.filename !== 'string') {
    throw new Error('缺少要保存的檔名。');
  }

  const directoryPath = await getConfiguredDataDirectoryPath();
  const directory = await ensureDataDirectory(directoryPath);
  const filePath = resolveDataFilePath(directory.path, payload.filename);
  await fs.writeFile(filePath, toBuffer(payload.contents));

  return {
    filename: path.basename(filePath),
    path: filePath,
    directory,
  };
}

function getPmToolHtmlPath() {
  return path.join(app.getAppPath(), 'frontend', 'dist-pm-tool', 'pm-tool.html');
}

async function createWindow() {
  await ensureDataDirectory();

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 1080,
    minHeight: 720,
    title: PRODUCT_TITLE,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const htmlPath = getPmToolHtmlPath();
  if (!fsSync.existsSync(htmlPath)) {
    dialog.showErrorBox(PRODUCT_TITLE, '找不到 PM tool 產物，請先執行 npm run pm-tool:build。');
    return;
  }

  await mainWindow.loadFile(htmlPath);
}

ipcMain.handle('pm-tool:get-data-directory', async () => ensureDataDirectory());

ipcMain.handle('pm-tool:choose-data-directory', async () => {
  const currentDirectory = await getConfiguredDataDirectoryPath();
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '選擇 PM 機率工具資料夾',
    defaultPath: currentDirectory,
    properties: ['openDirectory', 'createDirectory'],
  });

  if (result.canceled || !result.filePaths[0]) {
    return null;
  }

  const directoryPath = result.filePaths[0];
  await writeSettings({
    ...(await readSettings()),
    dataDirectoryPath: directoryPath,
  });

  return ensureDataDirectory(directoryPath);
});

ipcMain.handle('pm-tool:save-file', async (_event, payload) => saveFileToDataDirectory(payload));

ipcMain.handle('pm-tool:show-item-in-folder', async (_event, filePath) => {
  if (typeof filePath === 'string' && filePath) {
    shell.showItemInFolder(filePath);
  }
});

app.setAppUserModelId('com.wheelevent.pmtool');

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
