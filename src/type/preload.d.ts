import { IpcRenderer } from "electron";
import { IpcRendererEvent } from "electron/main";

export interface Sandbox {
  getAppInfos(): Promise<AppInfos>;
  getCharacterInfos(): Promise<CharacterInfo[]>;
  getOssLicenses(): Promise<Record<string, string>[]>;
  getUpdateInfos(): Promise<Record<string, any>[]>;
  saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }): void;
  loadTempFile(): Promise<string>;
  showAudioSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showOpenDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showProjectSaveDialog(obj: { title: string }): Promise<string | undefined>;
  showProjectLoadDialog(obj: { title: string }): Promise<string[] | undefined>;
  showConfirmDialog(obj: { title: string; message: string }): Promise<boolean>;
  showErrorDialog(obj: { title: string; message: string }): Promise<void>;
  showImportFileDialog(obj: { title: string }): Promise<string | undefined>;
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }): void;
  readFile(obj: { filePath: string }): Promise<ArrayBuffer>;
  createHelpWindow(): void;
  openTextEditContextMenu(): Promise<void>;
  updateMenu(uiLocked: boolean): void;
  onReceivedIPCMsg(
    channel: string,
    callback: (event: IpcRendererEvent, ...argv) => void
  ): IpcRenderer;
}

export type AppInfos = {
  name: string;
  version: string;
};

export type CharacterInfo = {
  dirPath: string;
  iconPath: string;
  iconBlob?: Blob;
  metas: {
    name: string;
    speaker: number;
    policy: string;
  };
};
