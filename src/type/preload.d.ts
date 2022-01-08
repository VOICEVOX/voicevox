import { IpcRenderer, IpcRendererEvent } from "electron";

export interface Sandbox {
  getAppInfos(): Promise<AppInfos>;
  getHowToUseText(): Promise<string>;
  getPolicyText(): Promise<string>;
  getOssLicenses(): Promise<Record<string, string>[]>;
  getUpdateInfos(): Promise<UpdateInfo[]>;
  getOssCommunityInfos(): Promise<string>;
  getPrivacyPolicyText(): Promise<string>;
  saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }): void;
  loadTempFile(): Promise<string>;
  getBaseName(obj: { filePath: string }): string;
  showAudioSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showOpenDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showProjectSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showProjectLoadDialog(obj: { title: string }): Promise<string[] | undefined>;
  showInfoDialog(obj: {
    title: string;
    message: string;
    buttons: string[];
  }): Promise<number>;
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
  inheritAudioInfo(newValue?: boolean): Promise<boolean>;
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
  engines(): Promise<Engine[]>;
  restartEngine(): Promise<void>;
  savingSetting(newData?: SavingSetting): Promise<SavingSetting>;
  hotkeySettings(newData?: HotkeySetting): Promise<HotkeySetting[]>;
  toolbarSetting(newData?: ToolbarSetting): Promise<ToolbarSetting>;
  checkFileExists(file: string): Promise<boolean>;
  changePinWindow(): void;
  savingPresets(newPresets?: {
    presetItems: Record<string, Preset>;
    presetKeys: string[];
  }): Promise<PresetConfig>;
  isUnsetDefaultStyleId(speakerUuid: string): Promise<boolean>;
  getDefaultStyleIds(): Promise<DefaultStyleId[]>;
  setDefaultStyleIds(
    defaultStyleIds: { speakerUuid: string; defaultStyleId: number }[]
  ): Promise<void>;
  getAcceptRetrieveTelemetry(): Promise<AcceptRetrieveTelemetryStatus>;
  setAcceptRetrieveTelemetry(
    acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus
  ): Promise<void>;
  getExperimentalSetting(): Promise<ExperimentalSetting>;
  setExperimentalSetting(
    enableInterrogative: ExperimentalSetting
  ): Promise<void>;
  getDefaultHotkeySettings(): Promise<HotKeySetting[]>;
  theme(newData?: string): Promise<ThemeSetting | void>;
  vuexReady(): void;
}

export type AppInfos = {
  name: string;
  version: string;
};

export type StyleInfo = {
  styleName?: string;
  styleId: number;
  iconPath: string;
  voiceSamplePaths: string[];
};

export type MetasJson = {
  speakerName: string;
  speakerUuid: string;
  styles: Pick<StyleInfo, "styleName" | "styleId">[];
};

export type CharacterInfo = {
  portraitPath: string;
  metas: {
    speakerUuid: string;
    speakerName: string;
    styles: StyleInfo[];
    policy: string;
  };
};

export type UpdateInfo = {
  version: string;
  descriptions: string[];
  contributors: string[];
};

export type Encoding = "UTF-8" | "Shift_JIS";

export type AcceptRetrieveTelemetryStatus =
  | "Unconfirmed"
  | "Accepted"
  | "Refused";

export type SavingSetting = {
  exportLab: boolean;
  fileEncoding: Encoding;
  fixedExportEnabled: boolean;
  fixedExportDir: string;
  avoidOverwrite: boolean;
  exportText: boolean;
  outputStereo: boolean;
  outputSamplingRate: number;
  audioOutputDevice: string;
};

export type DefaultStyleId = {
  speakerUuid: string;
  defaultStyleId: number;
};

export type HotkeySetting = {
  action: HotkeyAction;
  combination: HotkeyCombo;
};

export type Engine = {
  host: string;
  executionEnabled: boolean;
  executionFilePath: string;
};

export type Preset = {
  name: string;
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
};

export type PresetConfig = {
  items: Record<string, Preset>;
  keys: string[];
};
export type HotkeyAction =
  | "音声書き出し"
  | "一つだけ書き出し"
  | "音声を繋げて書き出し"
  | "再生/停止"
  | "連続再生/停止"
  | "ｱｸｾﾝﾄ欄を表示"
  | "ｲﾝﾄﾈｰｼｮﾝ欄を表示"
  | "長さ欄を表示"
  | "テキスト欄を追加"
  | "テキスト欄を削除"
  | "テキスト欄からフォーカスを外す"
  | "テキスト欄にフォーカスを戻す"
  | "元に戻す"
  | "やり直す"
  | "新規プロジェクト"
  | "プロジェクトを名前を付けて保存"
  | "プロジェクトを上書き保存"
  | "プロジェクト読み込み"
  | "テキスト読み込む";

export type HotkeyCombo = string;

export type HotkeyReturnType =
  | void
  | boolean
  | Promise<void>
  | Promise<boolean>;

export type ToolbarButtonTagType =
  | "PLAY_CONTINUOUSLY"
  | "STOP"
  | "UNDO"
  | "REDO"
  | "EMPTY";

export type ToolbarSetting = ToolbarButtonTagType[];

export type MoraDataType =
  | "consonant"
  | "vowel"
  | "pitch"
  | "pause"
  | "voicing";

export type ThemeColorType =
  | "primary"
  | "primary-light"
  | "display"
  | "display-light"
  | "display-dark"
  | "background"
  | "background-light"
  | "setting-item"
  | "warning"
  | "markdown-color"
  | "markdown-background"
  | "markdown-hyperlink"
  | "pause-hovered";

export type ThemeConf = {
  name: string;
  isDark: boolean;
  colors: {
    [K in ThemeColorType]: string;
  };
};

export type ThemeSetting = {
  currentTheme: string;
  availableThemes: ThemeConf[];
};

export type ExperimentalSetting = {
  enableInterrogative: boolean;
  enableReorderCell: boolean;
};
