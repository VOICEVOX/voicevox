import { z } from "zod";
import { IpcSOData } from "./ipc";
import { AltPortInfos } from "@/store/type";
import { Result } from "@/type/result";

export const isProduction = import.meta.env.MODE === "production";
export const isElectron = import.meta.env.VITE_TARGET === "electron";
export const isBrowser = import.meta.env.VITE_TARGET === "browser";

// electronのメイン・レンダラープロセス内、ブラウザ内どこでも使用可能なOS判定
function checkOs(os: "windows" | "mac"): boolean {
  let isSpecifiedOs: boolean | undefined = undefined;
  if (process?.platform) {
    // electronのメインプロセス用
    isSpecifiedOs =
      process.platform === (os === "windows" ? "win32" : "darwin");
  } else if (navigator?.userAgentData) {
    // electronのレンダラープロセス用、Chrome系統が実装する実験的機能
    isSpecifiedOs = navigator.userAgentData.platform.toLowerCase().includes(os);
  } else if (navigator?.platform) {
    // ブラウザ用、非推奨機能
    isSpecifiedOs = navigator.platform.toLowerCase().includes(os);
  } else {
    // ブラウザ用、不正確
    isSpecifiedOs = navigator.userAgent.toLowerCase().includes(os);
  }
  return isSpecifiedOs;
}

export const isMac = checkOs("mac");
export const isWindows = checkOs("windows");

const urlStringSchema = z.string().url().brand("URL");
export type UrlString = z.infer<typeof urlStringSchema>;
export const UrlString = (url: string): UrlString => urlStringSchema.parse(url);

const hotkeyCombinationSchema = z.string().brand("HotkeyCombination");
export type HotkeyCombination = z.infer<typeof hotkeyCombinationSchema>;
export const HotkeyCombination = (
  hotkeyCombination: string,
): HotkeyCombination => hotkeyCombinationSchema.parse(hotkeyCombination);

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

export const noteIdSchema = z.string().brand<"NoteId">();
export type NoteId = z.infer<typeof noteIdSchema>;
export const NoteId = (id: string): NoteId => noteIdSchema.parse(id);

export const commandIdSchema = z.string().brand<"CommandId">();
export type CommandId = z.infer<typeof commandIdSchema>;
export const CommandId = (id: string): CommandId => commandIdSchema.parse(id);

export const trackIdSchema = z.string().brand<"TrackId">();
export type TrackId = z.infer<typeof trackIdSchema>;
export const TrackId = (id: string): TrackId => trackIdSchema.parse(id);

// 共通のアクション名
export const actionPostfixSelectNthCharacter = "番目のキャラクターを選択";

// ホットキーを追加したときは設定のマイグレーションが必要
export const defaultHotkeySettings: HotkeySettingType[] = [
  {
    action: "音声書き出し",
    combination: HotkeyCombination(!isMac ? "Ctrl E" : "Meta E"),
  },
  {
    action: "選択音声を書き出し",
    combination: HotkeyCombination("E"),
  },
  {
    action: "音声を繋げて書き出し",
    combination: HotkeyCombination(""),
  },
  {
    action: "再生/停止",
    combination: HotkeyCombination("Space"),
  },
  {
    action: "連続再生/停止",
    combination: HotkeyCombination("Shift Space"),
  },
  {
    action: "ｱｸｾﾝﾄ欄を表示",
    combination: HotkeyCombination("1"),
  },
  {
    action: "ｲﾝﾄﾈｰｼｮﾝ欄を表示",
    combination: HotkeyCombination("2"),
  },
  {
    action: "長さ欄を表示",
    combination: HotkeyCombination("3"),
  },
  {
    action: "テキスト欄を追加",
    combination: HotkeyCombination("Shift Enter"),
  },
  {
    action: "テキスト欄を複製",
    combination: HotkeyCombination(!isMac ? "Ctrl D" : "Meta D"),
  },
  {
    action: "テキスト欄を削除",
    combination: HotkeyCombination("Shift Delete"),
  },
  {
    action: "テキスト欄からフォーカスを外す",
    combination: HotkeyCombination("Escape"),
  },
  {
    action: "テキスト欄にフォーカスを戻す",
    combination: HotkeyCombination("Enter"),
  },
  {
    action: "元に戻す",
    combination: HotkeyCombination(!isMac ? "Ctrl Z" : "Meta Z"),
  },
  {
    action: "やり直す",
    combination: HotkeyCombination(!isMac ? "Ctrl Y" : "Shift Meta Z"),
  },
  {
    action: "新規プロジェクト",
    combination: HotkeyCombination(!isMac ? "Ctrl N" : "Meta N"),
  },
  {
    action: "プロジェクトを名前を付けて保存",
    combination: HotkeyCombination(!isMac ? "Ctrl Shift S" : "Shift Meta S"),
  },
  {
    action: "プロジェクトを上書き保存",
    combination: HotkeyCombination(!isMac ? "Ctrl S" : "Meta S"),
  },
  {
    action: "プロジェクトを読み込む",
    combination: HotkeyCombination(!isMac ? "Ctrl O" : "Meta O"),
  },
  {
    action: "テキストを読み込む",
    combination: HotkeyCombination(""),
  },
  {
    action: "全体のイントネーションをリセット",
    combination: HotkeyCombination(!isMac ? "Ctrl G" : "Meta G"),
  },
  {
    action: "選択中のアクセント句のイントネーションをリセット",
    combination: HotkeyCombination("R"),
  },
  {
    action: "コピー",
    combination: HotkeyCombination(!isMac ? "Ctrl C" : "Meta C"),
  },
  {
    action: "切り取り",
    combination: HotkeyCombination(!isMac ? "Ctrl X" : "Meta X"),
  },
  {
    action: "貼り付け",
    combination: HotkeyCombination(!isMac ? "Ctrl V" : "Meta V"),
  },
  {
    action: "すべて選択",
    combination: HotkeyCombination(!isMac ? "Ctrl A" : "Meta A"),
  },
  {
    action: "選択解除",
    combination: HotkeyCombination("Escape"),
  },
  ...Array.from({ length: 10 }, (_, index) => {
    const roleKey = index == 9 ? 0 : index + 1;
    return {
      action:
        `${index + 1}${actionPostfixSelectNthCharacter}` as HotkeyActionNameType,
      combination: HotkeyCombination(`${!isMac ? "Ctrl" : "Meta"} ${roleKey}`),
    };
  }),
];

export const defaultToolbarButtonSetting: ToolbarSettingType = [
  "PLAY_CONTINUOUSLY",
  "STOP",
  "EXPORT_AUDIO_SELECTED",
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
  showSaveDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
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
  showImportFileDialog(obj: {
    title: string;
    name?: string;
    extensions?: string[];
  }): Promise<string | undefined>;
  writeFile(obj: {
    filePath: string;
    buffer: ArrayBuffer;
  }): Promise<Result<undefined>>;
  readFile(obj: { filePath: string }): Promise<Result<ArrayBuffer>>;
  isAvailableGPUMode(): Promise<boolean>;
  isMaximizedWindow(): Promise<boolean>;
  onReceivedIPCMsg(listeners: {
    [K in keyof IpcSOData]: (
      event: unknown,
      ...args: IpcSOData[K]["args"]
    ) => Promise<IpcSOData[K]["return"]> | IpcSOData[K]["return"];
  }): void;
  closeWindow(): void;
  minimizeWindow(): void;
  maximizeWindow(): void;
  logError(...params: unknown[]): void;
  logWarn(...params: unknown[]): void;
  logInfo(...params: unknown[]): void;
  openLogDirectory(): void;
  engineInfos(): Promise<EngineInfo[]>;
  restartEngine(engineId: EngineId): Promise<void>;
  openEngineDirectory(engineId: EngineId): void;
  hotkeySettings(newData?: HotkeySettingType): Promise<HotkeySettingType[]>;
  checkFileExists(file: string): Promise<boolean>;
  changePinWindow(): void;
  getDefaultHotkeySettings(): Promise<HotkeySettingType[]>;
  getDefaultToolbarSetting(): Promise<ToolbarSettingType>;
  setNativeTheme(source: NativeThemeType): void;
  theme(newData?: string): Promise<ThemeSetting | void>;
  vuexReady(): void;
  getSetting<Key extends keyof ConfigType>(key: Key): Promise<ConfigType[Key]>;
  setSetting<Key extends keyof ConfigType>(
    key: Key,
    newValue: ConfigType[Key],
  ): Promise<ConfigType[Key]>;
  setEngineSetting(
    engineId: EngineId,
    engineSetting: EngineSettingType,
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

export type StyleType = "talk" | "singing_teacher" | "frame_decode" | "sing";

export type StyleInfo = {
  styleName?: string;
  styleId: StyleId;
  styleType?: StyleType;
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

export const updateInfoSchema = z.object({
  version: z.string(),
  descriptions: z.array(z.string()),
  contributors: z.array(z.string()),
});
export type UpdateInfo = z.infer<typeof updateInfoSchema>;

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

export type EngineSettings = Record<EngineId, EngineSettingType>;

export const engineSettingSchema = z.object({
  useGpu: z.boolean().default(false),
  outputSamplingRate: z
    .union([z.number(), z.literal("engineDefault")])
    .default("engineDefault"),
});
export type EngineSettingType = z.infer<typeof engineSettingSchema>;

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

export const minimumEngineManifestSchema = z.object({
  name: z.string(),
  uuid: engineIdSchema,
  command: z.string(),
  port: z.number(),
  supported_features: z.record(z.string(), supportedFeaturesItemSchema), // FIXME:JSON側はsnake_caseなので合わせているが、camelCaseに修正する
});

export type MinimumEngineManifestType = z.infer<
  typeof minimumEngineManifestSchema
>;

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

export type MorphableTargetInfoTable = Record<
  StyleId,
  | undefined
  | Record<
      StyleId,
      {
        isMorphable: boolean;
      }
    >
>;

export const hotkeyActionNameSchema = z.enum([
  "音声書き出し",
  "選択音声を書き出し",
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
  "プロジェクトを読み込む",
  "テキストを読み込む",
  "全体のイントネーションをリセット",
  "選択中のアクセント句のイントネーションをリセット",
  "コピー",
  "切り取り",
  "貼り付け",
  "すべて選択",
  "選択解除",
  "全セルを選択",
  `1${actionPostfixSelectNthCharacter}`,
  `2${actionPostfixSelectNthCharacter}`,
  `3${actionPostfixSelectNthCharacter}`,
  `4${actionPostfixSelectNthCharacter}`,
  `5${actionPostfixSelectNthCharacter}`,
  `6${actionPostfixSelectNthCharacter}`,
  `7${actionPostfixSelectNthCharacter}`,
  `8${actionPostfixSelectNthCharacter}`,
  `9${actionPostfixSelectNthCharacter}`,
  `10${actionPostfixSelectNthCharacter}`,
]);

export type HotkeyActionNameType = z.infer<typeof hotkeyActionNameSchema>;

export const hotkeySettingSchema = z.object({
  action: hotkeyActionNameSchema,
  combination: hotkeyCombinationSchema,
});
export type HotkeySettingType = z.infer<typeof hotkeySettingSchema>;

export type HotkeyReturnType =
  | void
  | boolean
  | Promise<void>
  | Promise<boolean>;

export const toolbarButtonTagSchema = z.enum([
  "PLAY_CONTINUOUSLY",
  "STOP",
  "EXPORT_AUDIO_SELECTED",
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
export type ToolbarSettingType = z.infer<typeof toolbarSettingSchema>[];

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
  enableMultiSelect: z.boolean().default(false),
  shouldKeepTuningOnTextChange: z.boolean().default(false),
  enableMultiTrack: z.boolean().default(false),
});

export type ExperimentalSettingType = z.infer<typeof experimentalSettingSchema>;

export const splitterPositionSchema = z.object({
  portraitPaneWidth: z.number().optional(),
  audioInfoPaneWidth: z.number().optional(),
  audioDetailPaneHeight: z.number().optional(),
});
export type SplitterPositionType = z.infer<typeof splitterPositionSchema>;

export type ConfirmedTips = {
  tweakableSliderByScroll: boolean;
  engineStartedOnAltPort: boolean; // エンジンのポート変更の通知
  notifyOnGenerate: boolean; // 音声書き出し時の通知
};

// ルート直下にある雑多な設定値
export const rootMiscSettingSchema = z.object({
  editorFont: z.enum(["default", "os"]).default("default"),
  showTextLineNumber: z.boolean().default(false),
  showAddAudioItemButton: z.boolean().default(true),
  splitTextWhenPaste: z
    .enum(["PERIOD_AND_NEW_LINE", "NEW_LINE", "OFF"])
    .default("PERIOD_AND_NEW_LINE"),
  splitterPosition: splitterPositionSchema.default({}),
  enableMultiEngine: z.boolean().default(false),
  enableMemoNotation: z.boolean().default(false), // メモ記法を有効にするか
  enableRubyNotation: z.boolean().default(false), // ルビ記法を有効にするか
  skipUpdateVersion: z.string().optional(), // アップデートをスキップしたバージョン
  undoableTrackOperations: z // ソングエディタでどのトラック操作をUndo可能にするか
    .object({
      soloAndMute: z.boolean().default(true),
      panAndGain: z.boolean().default(true),
    })
    .default({}),
  showSinger: z.boolean().default(true),
});
export type RootMiscSettingType = z.infer<typeof rootMiscSettingSchema>;

export const configSchema = z
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
      .default({}),
    hotkeySettings: hotkeySettingSchema.array().default(defaultHotkeySettings),
    toolbarSetting: toolbarSettingSchema
      .array()
      .default(defaultToolbarButtonSetting),
    engineSettings: z.record(engineIdSchema, engineSettingSchema).default({}),
    userCharacterOrder: speakerIdSchema.array().default([]),
    defaultStyleIds: z
      .object({
        engineId: engineIdSchema
          .or(z.literal(EngineId("00000000-0000-0000-0000-000000000000")))
          .default(EngineId("00000000-0000-0000-0000-000000000000")),
        speakerUuid: speakerIdSchema,
        defaultStyleId: styleIdSchema,
      })
      .array()
      .default([]),
    presets: z
      .object({
        items: z
          .record(
            presetKeySchema,
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
                  targetEngineId: engineIdSchema,
                  targetSpeakerId: speakerIdSchema,
                  targetStyleId: styleIdSchema,
                })
                .optional(),
            }),
          )
          .default({}),
        keys: presetKeySchema.array().default([]),
      })
      .default({}),
    defaultPresetKeys: z.record(voiceIdSchema, presetKeySchema).default({}),
    currentTheme: z.string().default("Default"),
    experimentalSetting: experimentalSettingSchema.default({}),
    acceptRetrieveTelemetry: z
      .enum(["Unconfirmed", "Accepted", "Refused"])
      .default("Unconfirmed"),
    acceptTerms: z
      .enum(["Unconfirmed", "Accepted", "Rejected"])
      .default("Unconfirmed"),
    confirmedTips: z
      .object({
        tweakableSliderByScroll: z.boolean().default(false),
        engineStartedOnAltPort: z.boolean().default(false),
        notifyOnGenerate: z.boolean().default(false),
      })
      .default({}),
    registeredEngineDirs: z.string().array().default([]),
    recentlyUsedProjects: z.string().array().default([]),
  })
  .merge(rootMiscSettingSchema);
export type ConfigType = z.infer<typeof configSchema>;

export const envEngineInfoSchema = z.object({
  uuid: engineIdSchema,
  host: z.string(),
  name: z.string(),
  executionEnabled: z.boolean(),
  executionFilePath: z.string(),
  executionArgs: z.array(z.string()),
  path: z.string().optional(),
});
export type EnvEngineInfoType = z.infer<typeof envEngineInfoSchema>;

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

export const SandboxKey = "backend";

export type EditorType = "talk" | "song";
