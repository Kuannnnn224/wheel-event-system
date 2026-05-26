/// <reference types="vite/client" />

interface PmToolDesktopDirectory {
  path: string;
  name: string;
}

interface PmToolSavedFile {
  filename: string;
  path: string;
  directory: PmToolDesktopDirectory;
}

interface PmToolDesktopBridge {
  getDataDirectory(): Promise<PmToolDesktopDirectory>;
  chooseDataDirectory(): Promise<PmToolDesktopDirectory | null>;
  saveFile(payload: { filename: string; contents: ArrayBuffer | string }): Promise<PmToolSavedFile>;
  showItemInFolder(filePath: string): Promise<void>;
}

interface Window {
  pmToolDesktop?: PmToolDesktopBridge;
}
