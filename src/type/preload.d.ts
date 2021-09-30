import { IpcRenderer, IpcRendererEvent } from "electron";

export interface Sandbox {
  getAppInfos(): Promise<AppInfos>;
  getCharacterInfos(): Promise<CharacterInfo[]>;
  getPolicyText(): Promise<string>;
  getOssLicenses(): Promise<Record<string, string>[]>;
  getUpdateInfos(): Promise<UpdateInfo[]>;
  saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }): void;
  loadTempFile(): Promise<string>;
  getBaseName(obj: { filePath: string }): string;
  showAudioSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showOpenDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showProjectSaveDialog(obj: { title: string }): Promise<string | undefined>;
  showProjectLoadDialog(obj: { title: string }): Promise<string[] | undefined>;
  showConfirmDialog(obj: { title: string; message: string }): Promise<boolean>;
  showWarningDialog(obj: {
    title: string;
    message: string;
  }): Promise<Electron.MessageBoxReturnValue>;
  showErrorDialog(obj: {
    title: string;
    message: string;
  }): Promise<Electron.MessageBoxReturnValue>;
  showImportFileDialog(obj: { title: string }): Promise<string | undefined>;
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }): void;
  readFile(obj: { filePath: string }): Promise<ArrayBuffer>;
  openTextEditContextMenu(): Promise<void>;
  useGpu(newValue?: boolean): Promise<boolean>;
  isAvailableGPUMode(): Promise<boolean>;
  onReceivedIPCMsg<T extends keyof IpcSOData>(
    channel: T,
    listener: (event: IpcRendererEvent, ...args: IpcSOData[T]["args"]) => void
  ): IpcRenderer;
  closeWindow(): void;
  minimizeWindow(): void;
  maximizeWindow(): void;
  logError(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
  restartEngine(): Promise<void>;
  savingSetting(newData?: SavingSetting): Promise<SavingSetting>;
  checkFileExists(file: string): Promise<boolean>;
  changePinWindow(): void;
}

export type AppInfos = {
  name: string;
  version: string;
};

export type CharacterInfo = {
  dirPath: string;
  iconPath: string;
  portraitPath: string;
  iconBlob?: Blob;
  portraitBlob?: Blob;
  metas: {
    name: string;
    speaker: number;
    policy: string;
  };
};

export type UpdateInfo = {
  version: string;
  descriptions: string[];
  contributors: string[];
};

export type Encoding = "UTF-8" | "Shift_JIS";

export type SavingSetting = {
  fileEncoding: Encoding;
  fixedExportEnabled: boolean;
  fixedExportDir: string;
  avoidOverwrite: boolean;
};
