import { z } from "zod";
import { IpcSOData } from "./ipc";
import { AltPortInfos } from "@/store/type";
import { Result } from "@/type/result";

export const isProduction = import.meta.env.MODE === "production";
export const isElectron = import.meta.env.VITE_TARGET === "electron";
export const isBrowser = import.meta.env.VITE_TARGET === "browser";

// electronのメイン・レンダラープロセス内、ブラウザ内どこでも使用可能なmacOS判定
function checkIsMac(): boolean {
  let isMac: boolean | undefined = undefined;
  if (process?.platform) {
    // electronのメインプロセス用
    isMac = process.platform === "darwin";
  } else if (navigator?.userAgentData) {
    // electronのレンダラープロセス用、Chrome系統が実装する実験的機能
    isMac = navigator.userAgentData.platform.toLowerCase().includes("mac");
  } else if (navigator?.platform) {
    // ブラウザ用、非推奨機能
    isMac = navigator.platform.toLowerCase().includes("mac");
  } else {
    // ブラウザ用、不正確
    isMac = navigator.userAgent.toLowerCase().includes("mac");
  }
  return isMac;
}
export const isMac = checkIsMac();

export const engineIdSchema = z.string().brand<"EngineId">();
export type EngineId = z.infer<typeof engineIdSchema>;
export const EngineId = (id: string): EngineId => engineIdSchema.parse(id);

export const speakerIdSchema = z.string().brand<"SpeakerId">();
export type SpeakerId = z.infer<typeof speakerIdSchema>;
export const SpeakerId = (id: string): SpeakerId => speakerIdSchema.parse(id);

export const styleIdSchema = z.number().brand<"StyleId">();
export type StyleId = z.infer<typeof styleIdSchema>;
export const StyleId = (id: number): StyleId => styleIdSchema.parse(id);

export const audioKeySchema = z.string().brand<"AudioKey">();
export type AudioKey = z.infer<typeof audioKeySchema>;
export const AudioKey = (id: string): AudioKey => audioKeySchema.parse(id);

export const presetKeySchema = z.string().brand<"PresetKey">();
export type PresetKey = z.infer<typeof presetKeySchema>;
export const PresetKey = (id: string): PresetKey => presetKeySchema.parse(id);

export const voiceIdSchema = z.string().brand<"VoiceId">();
export type VoiceId = z.infer<typeof voiceIdSchema>;
export const VoiceId = (voice: Voice): VoiceId =>
  voiceIdSchema.parse(`${voice.engineId}:${voice.speakerId}:${voice.styleId}`);

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
    action: "拡大",
    combination: !isMac ? "Ctrl +" : "Meta +",
  },
  {
    action: "縮小",
    combination: !isMac ? "Ctrl -" : "Meta -",
  },
  {
    action: "ズームのリセット",
    combination: !isMac ? "Ctrl 0" : "Meta 0",
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
  getAltPortInfos(): Promise<AltPortInfos>;
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
    defaultId?: number;
  }): Promise<number>;
  showImportFileDialog(obj: { title: string }): Promise<string | undefined>;
  writeFile(obj: {
    filePath: string;
    buffer: ArrayBuffer;
  }): Promise<Result<undefined>>;
  readFile(obj: { filePath: string }): Promise<Result<ArrayBuffer>>;
  isAvailableGPUMode(): Promise<boolean>;
  isMaximizedWindow(): Promise<boolean>;
  onReceivedIPCMsg<T extends keyof IpcSOData>(
    channel: T,
    listener: (event: unknown, ...args: IpcSOData[T]["args"]) => void
  ): void;
  closeWindow(): void;
  minimizeWindow(): void;
  maximizeWindow(): void;
  zoomIn(): void;
  zoomOut(): void;
  zoomReset(): void;
  logError(...params: unknown[]): void;
  logWarn(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
  openLogDirectory(): void;
  engineInfos(): Promise<EngineInfo[]>;
  restartEngine(engineId: EngineId): Promise<void>;
  openEngineDirectory(engineId: EngineId): void;
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
  setEngineSetting(
    engineId: EngineId,
    engineSetting: EngineSetting
  ): Promise<void>;
  installVvppEngine(path: string): Promise<boolean>;
  uninstallVvppEngine(engineId: EngineId): Promise<boolean>;
  validateEngineDir(engineDir: string): Promise<EngineDirValidationResult>;
  reloadApp(obj: { isMultiEngineOffMode?: boolean }): Promise<void>;
}

export type AppInfos = {
  name: string;
  version: string;
};

export type StyleInfo = {
  styleName?: string;
  styleId: StyleId;
  iconPath: string;
  portraitPath: string | undefined;
  engineId: EngineId;
  voiceSamplePaths: string[];
};

export type MetasJson = {
  speakerName: string;
  speakerUuid: SpeakerId;
  styles: Pick<StyleInfo, "styleName" | "styleId">[];
};

export type CharacterInfo = {
  portraitPath: string;
  metas: {
    speakerUuid: SpeakerId;
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
  engineId: EngineId;
  speakerId: SpeakerId;
  styleId: StyleId;
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
  audioOutputDevice: string;
};

export type EngineSettings = Record<EngineId, EngineSetting>;

export const engineSettingSchema = z
  .object({
    useGpu: z.boolean().default(false),
    outputSamplingRate: z
      .union([z.number(), z.literal("engineDefault")])
      .default("engineDefault"),
  })
  .passthrough();
export type EngineSetting = z.infer<typeof engineSettingSchema>;

export type DefaultStyleId = {
  engineId: EngineId;
  speakerUuid: SpeakerId;
  defaultStyleId: StyleId;
};

export const supportedFeaturesItemSchema = z.object({
  type: z.string(),
  value: z.boolean(),
  name: z.string(),
});

export const minimumEngineManifestSchema = z
  .object({
    name: z.string(),
    uuid: engineIdSchema,
    command: z.string(),
    port: z.number(),
    supported_features: z.record(z.string(), supportedFeaturesItemSchema), // FIXME:JSON側はsnake_caseなので合わせているが、camelCaseに修正する
  })
  .passthrough();

export type MinimumEngineManifest = z.infer<typeof minimumEngineManifestSchema>;

export type EngineInfo = {
  uuid: EngineId;
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
  targetEngineId: EngineId;
  targetSpeakerId: SpeakerId;
  targetStyleId: StyleId;
};

export type PresetConfig = {
  items: Record<string, Preset>;
  keys: string[];
};

export type MorphableTargetInfoTable = {
  [baseStyleId: StyleId]:
    | undefined
    | {
        [targetStyleId: StyleId]: {
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
  "拡大",
  "縮小",
  "ズームのリセット",
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

export const hotkeySettingSchema = z
  .object({
    action: hotkeyActionSchema,
    combination: z.string(),
  })
  .passthrough();
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

// base: typeof electron.nativeTheme["themeSource"];
export type NativeThemeType = "system" | "light" | "dark";

export type MoraDataType =
  | "consonant"
  | "vowel"
  | "pitch"
  | "pause"
  | "voicing";

export type ThemeColorType =
  | "primary"
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

export const experimentalSettingSchema = z.object({
  enablePreset: z.boolean().default(false),
  shouldApplyDefaultPresetOnVoiceChanged: z.boolean().default(false),
  enableInterrogativeUpspeak: z.boolean().default(false),
  enableMorphing: z.boolean().default(false),
  enableMultiEngine: z.boolean().default(false),
  enableMultiSelect: z.boolean().default(false),
});

export type ExperimentalSetting = z.infer<typeof experimentalSettingSchema>;

export const splitterPositionSchema = z
  .object({
    portraitPaneWidth: z.number().optional(),
    audioInfoPaneWidth: z.number().optional(),
    audioDetailPaneHeight: z.number().optional(),
  })
  .passthrough();
export type SplitterPosition = z.infer<typeof splitterPositionSchema>;

export type ConfirmedTips = {
  tweakableSliderByScroll: boolean;
  engineStartedOnAltPort: boolean; // エンジンのポート変更の通知
  notifyOnGenerate: boolean; // 音声書き出し時の通知
};

export const electronStoreSchema = z
  .object({
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
        audioOutputDevice: z.string().default(""),
      })
      .passthrough()
      .default({}),
    hotkeySettings: hotkeySettingSchema.array().default(defaultHotkeySettings),
    toolbarSetting: toolbarSettingSchema
      .array()
      .default(defaultToolbarButtonSetting),
    engineSettings: z.record(engineIdSchema, engineSettingSchema).default({}),
    userCharacterOrder: speakerIdSchema.array().default([]),
    defaultStyleIds: z
      .object({
        // FIXME: マイグレーション前にバリテーションされてしまう問題に対処したら.or(z.literal)を外す
        engineId: engineIdSchema
          .or(z.literal(EngineId("00000000-0000-0000-0000-000000000000")))
          .default(EngineId("00000000-0000-0000-0000-000000000000")),
        speakerUuid: speakerIdSchema,
        defaultStyleId: styleIdSchema,
      })
      .passthrough()
      .array()
      .default([]),
    presets: z
      .object({
        items: z
          .record(
            presetKeySchema,
            z
              .object({
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
                    targetEngineId: engineIdSchema,
                    targetSpeakerId: speakerIdSchema,
                    targetStyleId: styleIdSchema,
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough()
          )
          .default({}),
        keys: presetKeySchema.array().default([]),
      })
      .passthrough()
      .default({}),
    defaultPresetKeys: z.record(voiceIdSchema, presetKeySchema).default({}),
    currentTheme: z.string().default("Default"),
    editorFont: z.enum(["default", "os"]).default("default"),
    showTextLineNumber: z.boolean().default(false),
    showAddAudioItemButton: z.boolean().default(true),
    experimentalSetting: experimentalSettingSchema.passthrough().default({}),
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
        engineStartedOnAltPort: z.boolean().default(false),
        notifyOnGenerate: z.boolean().default(false),
      })
      .passthrough()
      .default({}),
    registeredEngineDirs: z.string().array().default([]),
    recentlyUsedProjects: z.string().array().default([]),
  })
  .passthrough();
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

export type EngineDirValidationResult =
  | "ok"
  | "directoryNotFound"
  | "manifestNotFound"
  | "invalidManifest"
  | "notADirectory"
  | "alreadyExists";

export type VvppFilePathValidationResult = "ok" | "fileNotFound";

// base: Electron.MessageBoxReturnValue
// FIXME: MessageBoxUIの戻り値として使用したい値が決まったら書き換える
export interface MessageBoxReturnValue {
  response: number;
  checkboxChecked: boolean;
}

export const SandboxKey = "electron" as const;
