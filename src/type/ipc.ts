import {
  ConfigType,
  EngineDirValidationResult,
  EngineId,
  EngineInfo,
  EngineSettingType,
  MessageBoxReturnValue,
  NativeThemeType,
  TextAsset,
  ToolbarSettingType,
} from "@/type/preload";
import { AltPortInfos } from "@/store/type";
import { Result } from "@/type/result";
import { HotkeySettingType } from "@/domain/hotkeyAction";

/**
 * invoke, handle
 */
export type IpcIHData = {
  GET_TEXT_ASSET: {
    args: [textType: keyof TextAsset];
    return: TextAsset[keyof TextAsset];
  };

  GET_ALT_PORT_INFOS: {
    args: [];
    return: AltPortInfos;
  };

  GET_INITIAL_PROJECT_FILE_PATH: {
    args: [];
    return: string | undefined;
  };

  SHOW_SAVE_DIRECTORY_DIALOG: {
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_OPEN_DIRECTORY_DIALOG: {
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_OPEN_FILE_DIALOG: {
    args: [
      obj: {
        title: string;
        name: string;
        extensions: string[];
        defaultPath?: string;
      },
    ];
    return?: string;
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

  SHOW_SAVE_FILE_DIALOG: {
    args: [
      obj: {
        title: string;
        defaultPath?: string;
        name: string;
        extensions: string[];
      },
    ];
    return?: string;
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

  TOGGLE_MAXIMIZE_WINDOW: {
    args: [];
    return: void;
  };

  TOGGLE_FULLSCREEN: {
    args: [];
    return: void;
  };

  ZOOM_IN: {
    args: [];
    return: void;
  };

  ZOOM_OUT: {
    args: [];
    return: void;
  };

  ZOOM_RESET: {
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

  GET_DEFAULT_TOOLBAR_SETTING: {
    args: [];
    return: ToolbarSettingType;
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
    args: [obj: { filePath: string; buffer: ArrayBuffer | Uint8Array }];
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
    args: [obj: { filePath: string }];
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
