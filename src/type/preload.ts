import { IpcRenderer, IpcRendererEvent, nativeTheme } from "electron";
import { IpcSOData } from "./ipc";
import { z } from "zod";

export const isMac = process.platform === "darwin";
// ホットキーを追加したときは設定のマイグレーションが必要
export const defaultHotkeySettings: HotkeySetting[] = [
  {
    action: "音声書き出し",
    combination: !isMac ? "Ctrl E" : "Meta E",
  },
  {
    action: "一つだけ書き出し",
    combination: "E",
  },
  {
    action: "音声を繋げて書き出し",
    combination: "",
  },
  {
    action: "再生/停止",
    combination: "Space",
  },
  {
    action: "連続再生/停止",
    combination: "Shift Space",
  },
  {
    action: "ｱｸｾﾝﾄ欄を表示",
    combination: "1",
  },
  {
    action: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
    combination: "2",
  },
  {
    action: "長さ欄を表示",
    combination: "3",
  },
  {
    action: "テキスト欄を追加",
    combination: "Shift Enter",
  },
  {
    action: "テキスト欄を複製",
    combination: !isMac ? "Ctrl D" : "Meta D",
  },
  {
    action: "テキスト欄を削除",
    combination: "Shift Delete",
  },
  {
    action: "テキスト欄からフォーカスを外す",
    combination: "Escape",
  },
  {
    action: "テキスト欄にフォーカスを戻す",
    combination: "Enter",
  },
  {
    action: "元に戻す",
    combination: !isMac ? "Ctrl Z" : "Meta Z",
  },
  {
    action: "やり直す",
    combination: !isMac ? "Ctrl Y" : "Shift Meta Z",
  },
  {
    action: "新規プロジェクト",
    combination: !isMac ? "Ctrl N" : "Meta N",
  },
  {
    action: "プロジェクトを名前を付けて保存",
    combination: !isMac ? "Ctrl Shift S" : "Shift Meta S",
  },
  {
    action: "プロジェクトを上書き保存",
    combination: !isMac ? "Ctrl S" : "Meta S",
  },
  {
    action: "プロジェクト読み込み",
    combination: !isMac ? "Ctrl O" : "Meta O",
  },
  {
    action: "テキスト読み込む",
    combination: "",
  },
  {
    action: "全体のイントネーションをリセット",
    combination: !isMac ? "Ctrl G" : "Meta G",
  },
  {
    action: "選択中のアクセント句のイントネーションをリセット",
    combination: "R",
  },
];

export const defaultToolbarButtonSetting: ToolbarSetting = [
  "PLAY_CONTINUOUSLY",
  "STOP",
  "EXPORT_AUDIO_ONE",
  "EMPTY",
  "UNDO",
  "REDO",
];

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
  showAudioSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showTextSaveDialog(obj: {
    title: string;
    defaultPath?: string;
  }): Promise<string | undefined>;
  showVvppOpenDialog(obj: {
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
  }): Promise<WriteFileErrorResult | undefined>;
  readFile(obj: { filePath: string }): Promise<ArrayBuffer>;
  openTextEditContextMenu(): Promise<void>;
  isAvailableGPUMode(): Promise<boolean>;
  isMaximizedWindow(): Promise<boolean>;
  onReceivedIPCMsg<T extends keyof IpcSOData>(
    channel: T,
    listener: (event: IpcRendererEvent, ...args: IpcSOData[T]["args"]) => void
  ): IpcRenderer;
  closeWindow(): void;
  minimizeWindow(): void;
  maximizeWindow(): void;
  logError(...params: unknown[]): void;
  logWarn(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
  engineInfos(): Promise<EngineInfo[]>;
  restartEngine(engineId: string): Promise<void>;
  openEngineDirectory(engineId: string): void;
  hotkeySettings(newData?: HotkeySetting): Promise<HotkeySetting[]>;
  checkFileExists(file: string): Promise<boolean>;
  changePinWindow(): void;
  getDefaultHotkeySettings(): Promise<HotkeySetting[]>;
  getDefaultToolbarSetting(): Promise<ToolbarSetting>;
  setNativeTheme(source: NativeThemeType): void;
  theme(newData?: string): Promise<ThemeSetting | void>;
  vuexReady(): void;
  getSetting<Key extends keyof ElectronStoreType>(
    key: Key
  ): Promise<ElectronStoreType[Key]>;
  setSetting<Key extends keyof ElectronStoreType>(
    key: Key,
    newValue: ElectronStoreType[Key]
  ): Promise<ElectronStoreType[Key]>;
  installVvppEngine(path: string): Promise<boolean>;
  uninstallVvppEngine(engineId: string): Promise<boolean>;
  validateEngineDir(engineDir: string): Promise<EngineDirValidationResult>;
  restartApp(obj: { isSafeMode: boolean }): void;
}

export type AppInfos = {
  name: string;
  version: string;
};

export type StyleInfo = {
  styleName?: string;
  styleId: number;
  iconPath: string;
  portraitPath: string | undefined;
  engineId: string;
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

export type Voice = {
  engineId: string;
  speakerId: string;
  styleId: number;
};

export type Encoding = "UTF-8" | "Shift_JIS";

export type AcceptRetrieveTelemetryStatus =
  | "Unconfirmed"
  | "Accepted"
  | "Refused";

export type AcceptTermsStatus = "Unconfirmed" | "Accepted" | "Rejected";

export type ActivePointScrollMode = "CONTINUOUSLY" | "PAGE" | "OFF";

export type SplitTextWhenPasteType = "PERIOD_AND_NEW_LINE" | "NEW_LINE" | "OFF";

export type EditorFontType = "default" | "os";

export type SavingSetting = {
  exportLab: boolean;
  fileEncoding: Encoding;
  fileNamePattern: string;
  fixedExportEnabled: boolean;
  fixedExportDir: string;
  avoidOverwrite: boolean;
  exportText: boolean;
  outputStereo: boolean;
  outputSamplingRate: number | "engineDefault";
  audioOutputDevice: string;
};

export type DefaultStyleId = {
  engineId: string;
  speakerUuid: string;
  defaultStyleId: number;
};

export type MinimumEngineManifest = {
  name: string;
  uuid: string;
  command: string;
  port: string;
};

export type EngineInfo = {
  uuid: string;
  host: string;
  name: string;
  path?: string; // エンジンディレクトリのパス
  executionEnabled: boolean;
  executionFilePath: string;
  executionArgs: string[];
  // エンジンの種類。
  // default: デフォルトエンジン
  // vvpp: vvppファイルから読み込んだエンジン
  // path: パスを指定して追加したエンジン
  type: "default" | "vvpp" | "path";
};

export type Preset = {
  name: string;
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  morphingInfo?: MorphingInfo;
};

export type MorphingInfo = {
  rate: number;
  targetEngineId: string;
  targetSpeakerId: string;
  targetStyleId: number;
};

export type PresetConfig = {
  items: Record<string, Preset>;
  keys: string[];
};

export type MorphableTargetsInfo = {
  [baseStyleId: number]:
    | undefined
    | {
        [targetStyleId: number]: {
          isMorphable: boolean;
        };
      };
};

export const hotkeyActionSchema = z.enum([
  "音声書き出し",
  "一つだけ書き出し",
  "音声を繋げて書き出し",
  "再生/停止",
  "連続再生/停止",
  "ｱｸｾﾝﾄ欄を表示",
  "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
  "長さ欄を表示",
  "テキスト欄を追加",
  "テキスト欄を複製",
  "テキスト欄を削除",
  "テキスト欄からフォーカスを外す",
  "テキスト欄にフォーカスを戻す",
  "元に戻す",
  "やり直す",
  "新規プロジェクト",
  "プロジェクトを名前を付けて保存",
  "プロジェクトを上書き保存",
  "プロジェクト読み込み",
  "テキスト読み込む",
  "全体のイントネーションをリセット",
  "選択中のアクセント句のイントネーションをリセット",
]);

export type HotkeyAction = z.infer<typeof hotkeyActionSchema>;

export type HotkeyCombo = string;

export const hotkeySettingSchema = z.object({
  action: hotkeyActionSchema,
  combination: z.string(),
});
export type HotkeySetting = z.infer<typeof hotkeySettingSchema>;

export type HotkeyReturnType =
  | void
  | boolean
  | Promise<void>
  | Promise<boolean>;

export const toolbarButtonTagSchema = z.enum([
  "PLAY_CONTINUOUSLY",
  "STOP",
  "EXPORT_AUDIO_ONE",
  "EXPORT_AUDIO_ALL",
  "EXPORT_AUDIO_CONNECT_ALL",
  "SAVE_PROJECT",
  "UNDO",
  "REDO",
  "IMPORT_TEXT",
  "EMPTY",
]);
export type ToolbarButtonTagType = z.infer<typeof toolbarButtonTagSchema>;

export const toolbarSettingSchema = toolbarButtonTagSchema;
export type ToolbarSetting = z.infer<typeof toolbarSettingSchema>[];

export type NativeThemeType = typeof nativeTheme["themeSource"];

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
  enableMorphing: boolean;
};

export const splitterPositionSchema = z.object({
  portraitPaneWidth: z.number().optional(),
  audioInfoPaneWidth: z.number().optional(),
  audioDetailPaneHeight: z.number().optional(),
});
export type SplitterPosition = z.infer<typeof splitterPositionSchema>;

export type ConfirmedTips = {
  tweakableSliderByScroll: boolean;
};
export const electronStoreSchema = z
  .object({
    useGpu: z.boolean().default(false),
    inheritAudioInfo: z.boolean().default(true),
    activePointScrollMode: z
      .enum(["CONTINUOUSLY", "PAGE", "OFF"])
      .default("OFF"),
    savingSetting: z
      .object({
        fileEncoding: z.enum(["UTF-8", "Shift_JIS"]).default("UTF-8"),
        fileNamePattern: z.string().default(""),
        fixedExportEnabled: z.boolean().default(false),
        avoidOverwrite: z.boolean().default(false),
        fixedExportDir: z.string().default(""),
        exportLab: z.boolean().default(false),
        exportText: z.boolean().default(false),
        outputStereo: z.boolean().default(false),
        outputSamplingRate: z
          .union([z.number(), z.literal("engineDefault")])
          .default("engineDefault"),
        audioOutputDevice: z.string().default(""),
      })
      .passthrough() // 別のブランチでの開発中の設定項目があるコンフィグで死ぬのを防ぐ
      .default({}),
    hotkeySettings: hotkeySettingSchema.array().default(defaultHotkeySettings),
    toolbarSetting: toolbarSettingSchema
      .array()
      .default(defaultToolbarButtonSetting),
    userCharacterOrder: z.string().array().default([]),
    defaultStyleIds: z
      .object({
        // FIXME: マイグレーション前にバリテーションされてしまう問題に対処したら".or(z.literal("")).default("")"を外す
        engineId: z.string().uuid().or(z.literal("")).default(""),
        speakerUuid: z.string().uuid(),
        defaultStyleId: z.number(),
      })
      .array()
      .default([]),
    presets: z
      .object({
        items: z
          .record(
            z.string().uuid(),
            z.object({
              name: z.string(),
              speedScale: z.number(),
              pitchScale: z.number(),
              intonationScale: z.number(),
              volumeScale: z.number(),
              prePhonemeLength: z.number(),
              postPhonemeLength: z.number(),
              morphingInfo: z
                .object({
                  rate: z.number(),
                  targetEngineId: z.string().uuid(),
                  targetSpeakerId: z.string().uuid(),
                  targetStyleId: z.number(),
                })
                .optional(),
            })
          )
          .default({}),
        keys: z.string().uuid().array().default([]),
      })
      .default({}),
    currentTheme: z.string().default("Default"),
    editorFont: z.enum(["default", "os"]).default("default"),
    experimentalSetting: z
      .object({
        enablePreset: z.boolean().default(false),
        enableInterrogativeUpspeak: z.boolean().default(false),
        enableMorphing: z.boolean().default(false),
      })
      .passthrough()
      .default({}),
    acceptRetrieveTelemetry: z
      .enum(["Unconfirmed", "Accepted", "Refused"])
      .default("Unconfirmed"),
    acceptTerms: z
      .enum(["Unconfirmed", "Accepted", "Rejected"])
      .default("Unconfirmed"),
    splitTextWhenPaste: z
      .enum(["PERIOD_AND_NEW_LINE", "NEW_LINE", "OFF"])
      .default("PERIOD_AND_NEW_LINE"),
    splitterPosition: splitterPositionSchema.default({}),
    confirmedTips: z
      .object({
        tweakableSliderByScroll: z.boolean().default(false),
      })
      .passthrough()
      .default({}),
    engineDirs: z.string().array().default([]),
  })
  .passthrough(); // release-0.14直前で消す
export type ElectronStoreType = z.infer<typeof electronStoreSchema>;

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

export type EngineDirValidationResult =
  | "ok"
  | "directoryNotFound"
  | "manifestNotFound"
  | "invalidManifest"
  | "notADirectory"
  | "alreadyExists";

export type VvppFilePathValidationResult = "ok" | "fileNotFound";
