import { z } from "zod";
import { IpcSOData } from "./ipc";
import { AltPortInfos } from "@/store/type";
import { Result } from "@/type/result";
import {
  HotkeySettingType,
  hotkeySettingSchema,
  getDefaultHotkeySettings,
} from "@/domain/hotkeyAction";

const urlStringSchema = z.string().url().brand("URL");
export type UrlString = z.infer<typeof urlStringSchema>;
export const UrlString = (url: string): UrlString => urlStringSchema.parse(url);

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

export const defaultToolbarButtonSetting: ToolbarSettingType = [
  "PLAY_CONTINUOUSLY",
  "STOP",
  "EXPORT_AUDIO_SELECTED",
  "EMPTY",
  "UNDO",
  "REDO",
];

export type TextAsset = {
  Contact: string;
  HowToUse: string;
  OssCommunityInfos: string;
  Policy: string;
  PrivacyPolicy: string;
  QAndA: string;
  OssLicenses: Record<string, string>[];
  UpdateInfos: UpdateInfo[];
};

export interface Sandbox {
  getTextAsset<K extends keyof TextAsset>(textType: K): Promise<TextAsset[K]>;
  getAltPortInfos(): Promise<AltPortInfos>;
  getInitialProjectFilePath(): Promise<string | undefined>;
  showSaveDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showOpenDirectoryDialog(obj: { title: string }): Promise<string | undefined>;
  showOpenFileDialog(obj: {
    title: string;
    name: string;
    mimeType: string;
    extensions: string[];
    defaultPath?: string;
  }): Promise<string | undefined>;
  showSaveFileDialog(obj: {
    title: string;
    name: string;
    extensions: string[];
    defaultPath?: string;
  }): Promise<string | undefined>;
  writeFile(obj: {
    filePath: string;
    buffer: ArrayBuffer | Uint8Array;
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
  toggleMaximizeWindow(): void;
  toggleFullScreen(): void;
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
  hotkeySettings(newData?: HotkeySettingType): Promise<HotkeySettingType[]>;
  checkFileExists(file: string): Promise<boolean>;
  changePinWindow(): void;
  getDefaultToolbarSetting(): Promise<ToolbarSettingType>;
  setNativeTheme(source: NativeThemeType): void;
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
  getPathForFile(file: File): string;
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

export type SavingSetting = ConfigType["savingSetting"];

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
  protocol: string; // `http:`など
  hostname: string; // `example.com`など
  defaultPort: string; // `50021`など。空文字列もありえる。
  pathname: string; // `/engine`など。空文字列もありえる。
  name: string;
  path?: string; // エンジンディレクトリのパス
  executionEnabled: boolean;
  executionFilePath: string;
  executionArgs: string[];
  // エンジンの種類。
  // vvpp: vvppファイルから読み込んだエンジン
  // path: パスを指定して追加したエンジン
  type: "vvpp" | "path";
  isDefault: boolean; // デフォルトエンジンかどうか
};

export type Preset = {
  name: string;
  speedScale: number;
  pitchScale: number;
  intonationScale: number;
  volumeScale: number;
  pauseLengthScale: number;
  prePhonemeLength: number;
  postPhonemeLength: number;
  morphingInfo?: MorphingInfo;
};
export type PresetSliderKey =
  | keyof Omit<Preset, "name" | "morphingInfo">
  | "morphingRate";

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

export const experimentalSettingSchema = z.object({
  enableInterrogativeUpspeak: z.boolean().default(false),
  enableMorphing: z.boolean().default(false),
  enableMultiSelect: z.boolean().default(false),
  shouldKeepTuningOnTextChange: z.boolean().default(false),
  showParameterPanel: z.boolean().default(false),
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
  openedEditor: z.enum(["talk", "song"]).default("talk"),
  editorFont: z.enum(["default", "os"]).default("default"),
  showTextLineNumber: z.boolean().default(false),
  showAddAudioItemButton: z.boolean().default(true),
  splitTextWhenPaste: z
    .enum(["PERIOD_AND_NEW_LINE", "NEW_LINE", "OFF"])
    .default("PERIOD_AND_NEW_LINE"),
  splitterPosition: splitterPositionSchema.default({}),
  enablePreset: z.boolean().default(false), // プリセット機能
  shouldApplyDefaultPresetOnVoiceChanged: z.boolean().default(false), // スタイル変更時にデフォルトプリセットを適用するか
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
  showSingCharacterPortrait: z.boolean().default(true), // ソングエディタで立ち絵を表示するか
  playheadPositionDisplayFormat: z
    .enum(["MINUTES_SECONDS", "MEASURES_BEATS"])
    .default("MINUTES_SECONDS"), // 再生ヘッド位置の表示モード
});
export type RootMiscSettingType = z.infer<typeof rootMiscSettingSchema>;

export function getConfigSchema({ isMac }: { isMac: boolean }) {
  return z
    .object({
      inheritAudioInfo: z.boolean().default(true),
      activePointScrollMode: z
        .enum(["CONTINUOUSLY", "PAGE", "OFF"])
        .default("OFF"),
      savingSetting: z
        .object({
          fileEncoding: z.enum(["UTF-8", "Shift_JIS"]).default("UTF-8"),
          fileNamePattern: z.string().default(""), // NOTE: ファイル名パターンは拡張子を含まない
          fixedExportEnabled: z.boolean().default(false),
          avoidOverwrite: z.boolean().default(false),
          fixedExportDir: z.string().default(""),
          exportLab: z.boolean().default(false),
          exportText: z.boolean().default(false),
          outputStereo: z.boolean().default(false),
          audioOutputDevice: z.string().default(""),
          songTrackFileNamePattern: z.string().default(""),
        })
        .default({}),
      hotkeySettings: hotkeySettingSchema
        .array()
        .default(getDefaultHotkeySettings({ isMac })),
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
                pauseLengthScale: z.number(),
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
}
export type ConfigType = z.infer<ReturnType<typeof getConfigSchema>>;

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
