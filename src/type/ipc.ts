import {
  AppInfos,
  ElectronStoreType,
  EngineInfo,
  HotkeySetting,
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

  SHOW_TEXT_SAVE_DIALOG: {
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

  SHOW_WARNING_DIALOG: {
    args: [
      obj: {
        title: string;
        message: string;
      }
    ];
    return: Electron.MessageBoxReturnValue;
  };

  SHOW_ERROR_DIALOG: {
    args: [
      obj: {
        title: string;
        message: string;
      }
    ];
    return: Electron.MessageBoxReturnValue;
  };

  OPEN_TEXT_EDIT_CONTEXT_MENU: {
    args: [];
    return: void;
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

  RESTART_ENGINE_ALL: {
    args: [];
    return: void;
  };

  RESTART_ENGINE: {
    args: [obj: { engineKey: string }];
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
    args: [obj: { newData?: HotkeySetting }];
    return: HotkeySetting[];
  };

  IS_UNSET_DEFAULT_STYLE_ID: {
    args: [speakerUuid: string];
    return: boolean;
  };

  GET_DEFAULT_HOTKEY_SETTINGS: {
    args: [];
    return: HotkeySetting[];
  };

  GET_DEFAULT_TOOLBAR_SETTING: {
    args: [];
    return: ToolbarSetting;
  };

  THEME: {
    args: [obj: { newData?: string }];
    return: ThemeSetting | void;
  };

  ON_VUEX_READY: {
    args: [];
    return: void;
  };

  // TODO: genericsが使用できないため、unknownで型宣言して実装時に型を付ける
  GET_SETTING: {
    args: [key: keyof ElectronStoreType];
    return: unknown;
  };

  SET_SETTING: {
    args: [key: keyof ElectronStoreType, newValue: unknown];
    return: unknown;
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
