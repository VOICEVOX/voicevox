type IpcData = {
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

  CREATE_HELP_WINDOW: {
    args: [];
    return: void;
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

  SHOW_ERROR_DIALOG: {
    args: [obj: { title: string; message: string }];
    return: void;
  };

  OPEN_TEXT_EDIT_CONTEXT_MENU: {
    args: [];
    return: void;
  };

  UPDATE_MENU: {
    args: [boolean];
    return: void;
  };
};

declare namespace Electron {
  interface IpcMain {
    handle<T extends keyof IpcData>(
      channel: T,
      listener: (
        event: IpcMainInvokeEvent,
        ...args: IpcData[T]["args"]
      ) => IpcData[T]["return"] | Promise<IpcData[T]["return"]>
    ): void;
  }

  interface IpcRenderer {
    invoke<T extends keyof IpcData>(
      channel: T,
      ...args: IpcData[T]["args"]
    ): Promise<IpcData[T]["return"]>;
  }
}
