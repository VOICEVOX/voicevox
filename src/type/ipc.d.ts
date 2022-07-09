import {
  AcceptRetrieveTelemetryStatus,
  AcceptTermsStatus,
  ActivePointScrollMode,
  AppInfos,
  DefaultStyleId,
  EngineInfo,
  ExperimentalSetting,
  HotkeySetting,
  Preset,
  PresetConfig,
  SavingSetting,
  SplitterPosition,
  SplitTextWhenPasteType,
  ThemeSetting,
  ToolbarSetting,
  UpdateInfo,
} from "@/type/preload";

/**
 * invoke, handle
 */
export type IpcIHData = {
  GET_APP_INFOS: {
    args: [];
    return: AppInfos;
  };

  GET_TEMP_DIR: {
    args: [];
    return: string;
  };

  GET_HOW_TO_USE_TEXT: {
    args: [];
    return: string;
  };

  GET_POLICY_TEXT: {
    args: [];
    return: string;
  };

  GET_OSS_LICENSES: {
    args: [];
    return: Record<string, string>[];
  };

  GET_UPDATE_INFOS: {
    args: [];
    return: UpdateInfo[];
  };

  GET_OSS_COMMUNITY_INFOS: {
    args: [];
    return: string;
  };

  GET_CONTACT_TEXT: {
    args: [];
    return: string;
  };

  GET_Q_AND_A_TEXT: {
    args: [];
    return: string;
  };

  GET_PRIVACY_POLICY_TEXT: {
    args: [];
    return: string;
  };

  SHOW_AUDIO_SAVE_DIALOG: {
    args: [obj: { title: string; defaultPath?: string }];
    return?: string;
  };

  SHOW_OPEN_DIRECTORY_DIALOG: {
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_IMPORT_FILE_DIALOG: {
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_PROJECT_SAVE_DIALOG: {
    args: [obj: { title: string; defaultPath?: string }];
    return?: string;
  };

  SHOW_PROJECT_LOAD_DIALOG: {
    args: [obj: { title: string }];
    return?: string[];
  };

  SHOW_MESSAGE_DIALOG: {
    args: [
      obj: {
        type: "none" | "info" | "error" | "question" | "warning";
        title: string;
        message: string;
      }
    ];
    return: Electron.MessageBoxReturnValue;
  };

  SHOW_QUESTION_DIALOG: {
    args: [
      obj: {
        type: "none" | "info" | "error" | "question" | "warning";
        title: string;
        message: string;
        buttons: string[];
        cancelId?: number;
      }
    ];
    return: number;
  };

  OPEN_TEXT_EDIT_CONTEXT_MENU: {
    args: [];
    return: void;
  };

  USE_GPU: {
    args: [obj: { newValue?: boolean }];
    return: boolean;
  };

  INHERIT_AUDIOINFO: {
    args: [obj: { newValue?: boolean }];
    return: boolean;
  };

  ACTIVE_POINT_SCROLL_MODE: {
    args: [obj: { newValue?: ActivePointScrollMode }];
    return: ActivePointScrollMode;
  };

  IS_AVAILABLE_GPU_MODE: {
    args: [];
    return: boolean;
  };

  CLOSE_WINDOW: {
    args: [];
    return: void;
  };

  MINIMIZE_WINDOW: {
    args: [];
    return: void;
  };

  MAXIMIZE_WINDOW: {
    args: [];
    return: void;
  };

  LOG_ERROR: {
    args: [...params: unknown[]];
    return: void;
  };

  LOG_INFO: {
    args: [...params: unknown[]];
    return: void;
  };

  ENGINE_INFOS: {
    args: [];
    return: EngineInfo[];
  };

  RESTART_ENGINE: {
    args: [obj: { engineKey: string }];
    return: void;
  };

  SAVING_SETTING: {
    args: [obj: { newData?: SavingSetting }];
    return: SavingSetting;
  };

  CHECK_FILE_EXISTS: {
    args: [obj: { file: string }];
    return: boolean;
  };

  CHANGE_PIN_WINDOW: {
    args: [];
    return: void;
  };

  SAVING_PRESETS: {
    args: [
      obj: {
        newPresets?: {
          presetItems: Record<string, Preset>;
          presetKeys: string[];
        };
      }
    ];
    return: PresetConfig;
  };

  HOTKEY_SETTINGS: {
    args: [obj: { newData?: HotkeySetting }];
    return: HotkeySetting[];
  };

  TOOLBAR_SETTING: {
    args: [obj: { newData?: ToolbarSetting }];
    return: ToolbarSetting;
  };

  GET_USER_CHARACTER_ORDER: {
    args: [];
    return: string[];
  };

  SET_USER_CHARACTER_ORDER: {
    args: [string[]];
    return: void;
  };

  IS_UNSET_DEFAULT_STYLE_ID: {
    args: [speakerUuid: string];
    return: boolean;
  };

  GET_DEFAULT_STYLE_IDS: {
    args: [];
    return: DefaultStyleId[];
  };

  SET_DEFAULT_STYLE_IDS: {
    args: [defaultStyleIds: { speakerUuid: string; defaultStyleId: number }[]];
    return: void;
  };

  GET_DEFAULT_HOTKEY_SETTINGS: {
    args: [];
    return: HotkeySetting[];
  };

  GET_DEFAULT_TOOLBAR_SETTING: {
    args: [];
    return: ToolbarSetting;
  };

  GET_ACCEPT_RETRIEVE_TELEMETRY: {
    args: [];
    return: AcceptRetrieveTelemetryStatus;
  };

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    args: [acceptRetrieveTelemetry: AcceptRetrieveTelemetryStatus];
    return: void;
  };
  GET_ACCEPT_TERMS: {
    args: [];
    return: AcceptTermsStatus;
  };

  SET_ACCEPT_TERMS: {
    args: [acceptTerms: AcceptTermsStatus];
    return: void;
  };
  GET_EXPERIMENTAL_SETTING: {
    args: [];
    return: ExperimentalSetting;
  };
  SET_EXPERIMENTAL_SETTING: {
    args: [experimentalSetting: ExperimentalSetting];
    return: void;
  };

  GET_SPLITTER_POSITION: {
    args: [];
    return: SplitterPosition;
  };

  SET_SPLITTER_POSITION: {
    args: [splitterPosition: SplitterPosition];
    return: void;
  };

  THEME: {
    args: [obj: { newData?: string }];
    return: ThemeSetting | void;
  };

  ON_VUEX_READY: {
    args: [];
    return: void;
  };

  GET_SPLIT_TEXT_WHEN_PASTE: {
    args: [];
    return: SplitTextWhenPasteType;
  };
  SET_SPLIT_TEXT_WHEN_PASTE: {
    args: [splitTextWhenPaste: SplitTextWhenPasteType];
    return: void;
  };
};

/**
 * send, on
 */
export type IpcSOData = {
  LOAD_PROJECT_FILE: {
    args: [obj: { filePath?: string; confirm?: boolean }];
    return: void;
  };

  DETECT_MAXIMIZED: {
    args: [];
    return: void;
  };

  DETECT_UNMAXIMIZED: {
    args: [];
    return: void;
  };

  DETECTED_ENGINE_ERROR: {
    args: [obj: { engineKey: string }];
    return: void;
  };

  DETECT_PINNED: {
    args: [];
    return: void;
  };

  DETECT_UNPINNED: {
    args: [];
    return: void;
  };

  DETECT_ENTER_FULLSCREEN: {
    args: [];
    return: void;
  };

  DETECT_LEAVE_FULLSCREEN: {
    args: [];
    return: void;
  };

  CHECK_EDITED_AND_NOT_SAVE: {
    args: [];
    return: void;
  };

  DETECT_RESIZED: {
    args: [obj: { width: number; height: number }];
    return: void;
  };
};
