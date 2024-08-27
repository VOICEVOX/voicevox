import {
  AppInfos,
  ConfigType,
  EngineInfo,
  EngineDirValidationResult,
  HotkeySettingType,
  ThemeSetting,
  ToolbarSettingType,
  UpdateInfo,
  NativeThemeType,
  EngineSettingType,
  EngineId,
  MessageBoxReturnValue,
} from "@/type/preload";
import { AltPortInfos } from "@/store/type";
import { Result } from "@/type/result";

/**
 * invoke, handle
 */
export type IpcIHData = {
  GET_APP_INFOS: {
    args: [];
    return: AppInfos;
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

  GET_ALT_PORT_INFOS: {
    args: [];
    return: AltPortInfos;
  };

  SHOW_AUDIO_SAVE_DIALOG: {
    args: [obj: { title: string; defaultPath?: string }];
    return?: string;
  };

  SHOW_TEXT_SAVE_DIALOG: {
    args: [obj: { title: string; defaultPath?: string }];
    return?: string;
  };

  SHOW_SAVE_DIRECTORY_DIALOG: {
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_VVPP_OPEN_DIALOG: {
    args: [obj: { title: string; defaultPath?: string }];
    return?: string;
  };

  SHOW_OPEN_DIRECTORY_DIALOG: {
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_IMPORT_FILE_DIALOG: {
    args: [obj: { title: string; name?: string; extensions?: string[] }];
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
      },
    ];
    return: MessageBoxReturnValue;
  };

  SHOW_QUESTION_DIALOG: {
    args: [
      obj: {
        type: "none" | "info" | "error" | "question" | "warning";
        title: string;
        message: string;
        buttons: string[];
        cancelId?: number;
        defaultId?: number;
      },
    ];
    return: number;
  };

  SHOW_WARNING_DIALOG: {
    args: [
      obj: {
        title: string;
        message: string;
      },
    ];
    return: MessageBoxReturnValue;
  };

  SHOW_ERROR_DIALOG: {
    args: [
      obj: {
        title: string;
        message: string;
      },
    ];
    return: MessageBoxReturnValue;
  };

  IS_AVAILABLE_GPU_MODE: {
    args: [];
    return: boolean;
  };

  IS_MAXIMIZED_WINDOW: {
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

  OPEN_LOG_DIRECTORY: {
    args: [];
    return: void;
  };

  ENGINE_INFOS: {
    args: [];
    return: EngineInfo[];
  };

  RESTART_ENGINE: {
    args: [obj: { engineId: EngineId }];
    return: void;
  };

  OPEN_ENGINE_DIRECTORY: {
    args: [obj: { engineId: EngineId }];
    return: void;
  };

  CHECK_FILE_EXISTS: {
    args: [obj: { file: string }];
    return: boolean;
  };

  CHANGE_PIN_WINDOW: {
    args: [];
    return: void;
  };

  HOTKEY_SETTINGS: {
    args: [obj: { newData?: HotkeySettingType }];
    return: HotkeySettingType[];
  };

  GET_DEFAULT_HOTKEY_SETTINGS: {
    args: [];
    return: HotkeySettingType[];
  };

  GET_DEFAULT_TOOLBAR_SETTING: {
    args: [];
    return: ToolbarSettingType;
  };

  THEME: {
    args: [obj: { newData?: string }];
    return: ThemeSetting | void;
  };

  ON_VUEX_READY: {
    args: [];
    return: void;
  };

  GET_SETTING: {
    args: [key: keyof ConfigType];
    return: ConfigType[keyof ConfigType];
  };

  SET_SETTING: {
    args: [key: keyof ConfigType, newValue: ConfigType[keyof ConfigType]];
    return: ConfigType[keyof ConfigType];
  };

  SET_ENGINE_SETTING: {
    args: [engineId: EngineId, engineSetting: EngineSettingType];
    return: void;
  };

  SET_NATIVE_THEME: {
    args: [source: NativeThemeType];
    return: void;
  };

  INSTALL_VVPP_ENGINE: {
    args: [path: string];
    return: Promise<boolean>;
  };

  UNINSTALL_VVPP_ENGINE: {
    args: [engineId: EngineId];
    return: Promise<boolean>;
  };

  VALIDATE_ENGINE_DIR: {
    args: [obj: { engineDir: string }];
    return: EngineDirValidationResult;
  };

  RELOAD_APP: {
    args: [obj: { isMultiEngineOffMode?: boolean }];
    return: void;
  };

  WRITE_FILE: {
    args: [obj: { filePath: string; buffer: ArrayBuffer }];
    return: Result<undefined>;
  };

  READ_FILE: {
    args: [obj: { filePath: string }];
    return: Result<ArrayBuffer>;
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
    args: [obj: { engineId: EngineId }];
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
    args: [
      obj: {
        closeOrReload: "close" | "reload";
        isMultiEngineOffMode?: boolean;
      },
    ];
    return: void;
  };

  DETECT_RESIZED: {
    args: [obj: { width: number; height: number }];
    return: void;
  };
};
