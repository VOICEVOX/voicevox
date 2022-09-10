import { IpcRenderer, IpcRendererEvent } from "electron";
import { IpcSOData } from "./ipc";

export interface ElectronStoreType {
  useGpu: boolean;
  inheritAudioInfo: boolean;
  activePointScrollMode: ActivePointScrollMode;
  savingSetting: SavingSetting;
  presets: PresetConfig;
  hotkeySettings: HotkeySetting[];
  toolbarSetting: ToolbarSetting;
  userCharacterOrder: string[];
  defaultStyleIds: DefaultStyleId[];
  currentTheme: string;
  experimentalSetting: ExperimentalSetting;
  acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus;
  acceptTerms: AcceptTermsStatus;
  splitTextWhenPaste: SplitTextWhenPasteType;
  splitterPosition: SplitterPosition;
  confirmedTips: ConfirmedTips;
}

export interface Sandbox {
  getAppInfos(): Promise<AppInfos>;
  getHowToUseText(): Promise<string>;
  getPolicyText(): Promise<string>;
  getOssLicenses(): Promise<Record<string, string>[]>;
  getUpdateInfos(): Promise<UpdateInfo[]>;
  getOssCommunityInfos(): Promise<string>;
  getQAndAText(): Promise<string>;
  getContactText(): Promise<string>;
  getPrivacyPolicyText(): Promise<string>;
  saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }): void;
  loadTempFile(): Promise<string>;
  getBaseName(obj: { filePath: string }): string;
  showAudioSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showTextSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showOpenDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showProjectSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showProjectLoadDialog(obj: { title: string }): Promise<string[] | undefined>;
  showMessageDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
  }): Promise<Electron.MessageBoxReturnValue>;
  showQuestionDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
    buttons: string[];
    cancelId?: number;
  }): Promise<number>;
  showImportFileDialog(obj: { title: string }): Promise<string | undefined>;
  writeFile(obj: {
    filePath: string;
    buffer: ArrayBuffer;
  }): WriteFileErrorResult | undefined;
  readFile(obj: { filePath: string }): Promise<ArrayBuffer>;
  openTextEditContextMenu(): Promise<void>;
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
  engineInfos(): Promise<EngineInfo[]>;
  restartEngineAll(): Promise<void>;
  restartEngine(engineId: string): Promise<void>;
  openEngineDirectory(engineId: string): void;
  hotkeySettings(newData?: HotkeySetting): Promise<HotkeySetting[]>;
  checkFileExists(file: string): Promise<boolean>;
  changePinWindow(): void;
  isUnsetDefaultStyleId(speakerUuid: string): Promise<boolean>;
  getDefaultHotkeySettings(): Promise<HotkeySetting[]>;
  getDefaultToolbarSetting(): Promise<ToolbarSetting>;
  theme(newData?: string): Promise<ThemeSetting | void>;
  vuexReady(): void;
  getSetting<Key extends keyof ElectronStoreType>(
    key: Key
  ): Promise<ElectronStoreType[Key]>;
  setSetting<Key extends keyof ElectronStoreType>(
    key: Key,
    newValue: ElectronStoreType[Key]
  ): Promise<ElectronStoreType[Key]>;
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

export type AcceptTermsStatus = "Unconfirmed" | "Accepted" | "Rejected";

export type ActivePointScrollMode = "CONTINUOUSLY" | "PAGE" | "OFF";

export type SplitTextWhenPasteType = "PERIOD_AND_NEW_LINE" | "NEW_LINE" | "OFF";

export type SavingSetting = {
  exportLab: boolean;
  fileEncoding: Encoding;
  fileNamePattern: string;
  fixedExportEnabled: boolean;
  fixedExportDir: string;
  avoidOverwrite: boolean;
  exportText: boolean;
  outputStereo: boolean;
  outputSamplingRate: number;
  audioOutputDevice: string;
};

// FIXME: engineIdを追加
export type DefaultStyleId = {
  speakerUuid: string;
  defaultStyleId: number;
};

export type HotkeySetting = {
  action: HotkeyAction;
  combination: HotkeyCombo;
};

export type EngineInfo = {
  uuid: string;
  host: string;
  name: string;
  iconPath?: string;
  iconData?: string;
  path?: string; // エンジンディレクトリのパス
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
  | "テキスト読み込む"
  | "全体のイントネーションをリセット"
  | "選択中のアクセント句のイントネーションをリセット";

export type HotkeyCombo = string;

export type HotkeyReturnType =
  | void
  | boolean
  | Promise<void>
  | Promise<boolean>;

export type ToolbarButtonTagType =
  | "PLAY_CONTINUOUSLY"
  | "STOP"
  | "EXPORT_AUDIO_ONE"
  | "EXPORT_AUDIO_ALL"
  | "EXPORT_AUDIO_CONNECT_ALL"
  | "SAVE_PROJECT"
  | "UNDO"
  | "REDO"
  | "IMPORT_TEXT"
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
  | "display-on-primary"
  | "display-hyperlink"
  | "background"
  | "surface"
  | "warning"
  | "text-splitter-hover"
  | "active-point-focus"
  | "active-point-hover";

export type ThemeConf = {
  name: string;
  displayName: string;
  order: number;
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
  enablePreset: boolean;
  enableInterrogativeUpspeak: boolean;
};

export type SplitterPosition = {
  portraitPaneWidth: number | undefined;
  audioInfoPaneWidth: number | undefined;
  audioDetailPaneHeight: number | undefined;
};

export type ConfirmedTips = {
  tweakableSliderByScroll: boolean;
};

// workaround. SystemError(https://nodejs.org/api/errors.html#class-systemerror)が2022/05/19時点ではNodeJSの型定義に記述されていないためこれを追加しています。
export class SystemError extends Error {
  code?: string | undefined;
  constructor(message: string, code?: string | undefined) {
    super(message);

    this.name = new.target.name;
    this.code = code;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SystemError);
    }
  }
}

export type WriteFileErrorResult = {
  code: string | undefined;
  message: string;
};
