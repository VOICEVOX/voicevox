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

  GET_CHARACTER_INFOS: {
    args: [];
    return: import("@/type/preload").CharacterInfo[];
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
    args: [obj: { title: string }];
    return?: string;
  };

  SHOW_PROJECT_LOAD_DIALOG: {
    args: [obj: { title: string }];
    return?: string[];
  };

  SHOW_CONFIRM_DIALOG: {
    args: [obj: { title: string; message: string }];
    return: boolean;
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

  HOTKEY_SETTINGS: {
    args: [obj: { newData?: import("@/type/preload").HotkeySetting }];
    return: import("@/type/preload").HotkeySetting[];
  };

  IS_UNSET_DEFAULT_STYLE_IDS: {
    args: [];
    return: boolean;
  };

  SET_DEFAULT_STYLE_IDS: {
    args: [defaultStyleIds: { speakerUuid: string; defaultStyleId: number }[]];
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
};
