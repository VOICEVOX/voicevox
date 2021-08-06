export interface Sandbox {
  getCharactorInfos(): Promise<CharactorInfo[]>;
  getOssLicenses(): Promise<Record<string, string>[]>;
  getUpdateInfos(): Promise<Record<string, any>[]>;
  saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }): void;
  loadTempFile(): Promise<string>;
  showSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showOpenDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showImportFileDialog(obj: { title: string }): Promise<string | undefined>;
  writeFile(obj: { filePath: string; buffer: ArrayBuffer });
  readFile(obj: { filePath: string }): Promise<ArrayBuffer>;
  createHelpWindow(): void;
}

export type CharactorInfo = {
  dirPath: string;
  iconPath: string;
  iconBlob?: Blob;
  metas: {
    name: string;
    speaker: number;
    policy: string;
  };
};
