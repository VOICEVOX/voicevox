/**
 * invoke, handle
 */
type IpcIHData = {
  GET_APP_INFOS: {
    args: [];
    return: import("@/type/preload").AppInfos;
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
    return: import("@/type/preload").UpdateInfo[];
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

  SHOW_INFO_DIALOG: {
    args: [
      obj: {
        title: string;
        message: string;
        buttons: string[];
        cancelId?: number;
      }
    ];
    return: number;
  };

  SHOW_WARNING_DIALOG: {
    args: [obj: { title: string; message: string }];
    return: Electron.MessageBoxReturnValue;
  };

  SHOW_ERROR_DIALOG: {
    args: [obj: { title: string; message: string }];
    return: Electron.MessageBoxReturnValue;
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
    args: [obj: { newValue?: import("@/type/preload").ActivePointScrollMode }];
    return: import("@/type/preload").ActivePointScrollMode;
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

  RESTART_ENGINE: {
    args: [];
    return: void;
  };

  SAVING_SETTING: {
    args: [obj: { newData?: import("@/type/preload").SavingSetting }];
    return: import("@/type/preload").SavingSetting;
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
          presetItems: Record<string, import("@/type/preload").Preset>;
          presetKeys: string[];
        };
      }
    ];
    return: import("@/type/preload").PresetConfig;
  };

  HOTKEY_SETTINGS: {
    args: [obj: { newData?: import("@/type/preload").HotkeySetting }];
    return: import("@/type/preload").HotkeySetting[];
  };

  TOOLBAR_SETTING: {
    args: [obj: { newData?: import("@/type/preload").ToolbarSetting }];
    return: import("@/type/preload").ToolbarSetting;
  };

  IS_UNSET_DEFAULT_STYLE_ID: {
    args: [speakerUuid: string];
    return: boolean;
  };

  GET_DEFAULT_STYLE_IDS: {
    args: [];
    return: import("@/type/preload").DefaultStyleId[];
  };

  SET_DEFAULT_STYLE_IDS: {
    args: [defaultStyleIds: { speakerUuid: string; defaultStyleId: number }[]];
    return: void;
  };

  GET_DEFAULT_HOTKEY_SETTINGS: {
    args: [];
    return: import("@/type/preload").HotkeySetting[];
  };

  GET_DEFAULT_TOOLBAR_SETTING: {
    args: [];
    return: import("@/type/preload").ToolbarSetting;
  };

  GET_ACCEPT_RETRIEVE_TELEMETRY: {
    args: [];
    return: import("@/type/preload").AcceptRetrieveTelemetryStatus;
  };

  SET_ACCEPT_RETRIEVE_TELEMETRY: {
    args: [
      acceptRetrieveTelemetry: import("@/type/preload").AcceptRetrieveTelemetryStatus
    ];
    return: void;
  };
  GET_ACCEPT_TERMS: {
    args: [];
    return: import("@/type/preload").AcceptTermsStatus;
  };

  SET_ACCEPT_TERMS: {
    args: [acceptTerms: import("@/type/preload").AcceptTermsStatus];
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

  THEME: {
    args: [obj: { newData?: string }];
    return: import("@/type/preload").ThemeSetting | void;
  };

  ON_VUEX_READY: {
    args: [];
    return: void;
  };
};

/**
 * send, on
 */
type IpcSOData = {
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
    args: [];
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
