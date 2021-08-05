import { contextBridge, ipcRenderer } from "electron";
import fs from "fs";
import path from "path";

import { Sandbox } from "@/type/preload";
import {
  GET_APP_INFOS,
  GET_TEMP_DIR,
  SHOW_AUDIO_SAVE_DIALOG,
  SHOW_OPEN_DIRECOTRY_DIALOG,
  GET_CHARACTOR_INFOS,
  GET_OSS_LICENSES,
  CREATE_HELP_WINDOW,
  SHOW_PROJECT_SAVE_DIALOG,
  SHOW_PROJECT_LOAD_DIALOG,
  SHOW_CONFIRM_DIALOG,
} from "./ipc";

let tempDir: string;

const api: Sandbox = {
  getAppInfos: async () => {
    return await ipcRenderer.invoke(GET_APP_INFOS);
  },

  getCharactorInfos: async () => {
    return await ipcRenderer.invoke(GET_CHARACTOR_INFOS);
  },

  getOssLicenses: async () => {
    return await ipcRenderer.invoke(GET_OSS_LICENSES);
  },

  saveTempAudioFile: async ({ relativePath, buffer }) => {
    if (!tempDir) {
      tempDir = await ipcRenderer.invoke(GET_TEMP_DIR);
    }
    fs.writeFileSync(path.join(tempDir, relativePath), new DataView(buffer));
  },

  loadTempFile: async () => {
    if (!tempDir) {
      tempDir = await ipcRenderer.invoke(GET_TEMP_DIR);
    }
    const buf = fs.readFileSync(path.join(tempDir, "hoge.txt"));
    return new TextDecoder().decode(buf);
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRenderer.invoke(SHOW_AUDIO_SAVE_DIALOG, { title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRenderer.invoke(SHOW_OPEN_DIRECOTRY_DIALOG, { title });
  },

  showProjectSaveDialog: ({ title }) => {
    return ipcRenderer.invoke(SHOW_PROJECT_SAVE_DIALOG, { title });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRenderer.invoke(SHOW_PROJECT_LOAD_DIALOG, { title });
  },

  showConfirmDialog: ({ title, message }) => {
    return ipcRenderer.invoke(SHOW_CONFIRM_DIALOG, { title, message });
  },

  writeFile: ({ filePath, buffer }) => {
    fs.writeFileSync(filePath, new DataView(buffer));
  },

  readFile: ({ filePath }) => {
    return fs.promises.readFile(filePath);
  },

  createHelpWindow: () => {
    ipcRenderer.invoke(CREATE_HELP_WINDOW);
  },
};

contextBridge.exposeInMainWorld("electron", api);
