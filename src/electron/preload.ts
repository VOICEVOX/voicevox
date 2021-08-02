import { contextBridge, ipcRenderer } from "electron";
import fs from "fs";
import path from "path";

import { Sandbox } from "@/type/preload";
import {
  GET_TEMP_DIR,
  SHOW_SAVE_DIALOG,
  SHOW_OPEN_DIRECOTRY_DIALOG,
  GET_CHARACTOR_INFOS,
  GET_OSS_LICENSES,
  CREATE_HELP_WINDOW,
  SHOW_IMPORT_FILE_DIALOG,
} from "./ipc";

let tempDir: string;

const api: Sandbox = {
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

  showSaveDialog: ({ title }) => {
    return ipcRenderer.invoke(SHOW_SAVE_DIALOG, { title });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRenderer.invoke(SHOW_OPEN_DIRECOTRY_DIALOG, { title });
  },

  showImportFileDialog: ({ title }) => {
    return ipcRenderer.invoke(SHOW_IMPORT_FILE_DIALOG, { title });
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
