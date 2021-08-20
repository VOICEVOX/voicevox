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
    return: Record<string, any>[];
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
    return: void;
  };

  SHOW_ERROR_DIALOG: {
    args: [obj: { title: string; message: string }];
    return: void;
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

  FILE_ENCODING: {
    args: [obj: { newValue?: import("@/type/preload").Encoding }];
    return: import("@/type/preload").Encoding;
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
};

declare namespace Electron {
  interface IpcMain {
    handle<T extends keyof IpcIHData>(
      channel: T,
      listener: (
        event: IpcMainInvokeEvent,
        ...args: IpcIHData[T]["args"]
      ) => IpcIHData[T]["return"] | Promise<IpcIHData[T]["return"]>
    ): void;
  }

  interface IpcRenderer {
    invoke<T extends keyof IpcIHData>(
      channel: T,
      ...args: IpcIHData[T]["args"]
    ): Promise<IpcIHData[T]["return"]>;

    on<T extends keyof IpcSOData>(
      channel: T,
      listener: (
        event: import("electron").IpcRendererEvent,
        ...args: IpcSOData[T]["args"]
      ) => void
    ): this;
  }

  interface WebContents {
    send<T extends keyof IpcSOData>(
      channel: T,
      ...args: IpcSOData[T]["args"]
    ): void;
  }
}
