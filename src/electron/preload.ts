import { contextBridge, ipcRenderer } from "electron";
import fs from "fs";
import path from "path";

import { Sandbox } from "@/type/preload";

let tempDir: string;

const api: Sandbox = {
  getAppInfos: async () => {
    return await ipcRenderer.invoke("GET_APP_INFOS");
  },

  getCharactorInfos: async () => {
    return await ipcRenderer.invoke("GET_CHARACTOR_INFOS");
  },

  getOssLicenses: async () => {
    return await ipcRenderer.invoke("GET_OSS_LICENSES");
  },

  getUpdateInfos: async () => {
    return await ipcRenderer.invoke("GET_UPDATE_INFOS");
  },

  saveTempAudioFile: async ({ relativePath, buffer }) => {
    if (!tempDir) {
      tempDir = await ipcRenderer.invoke("GET_TEMP_DIR");
    }
    fs.writeFileSync(path.join(tempDir, relativePath), new DataView(buffer));
  },

  loadTempFile: async () => {
    if (!tempDir) {
      tempDir = await ipcRenderer.invoke("GET_TEMP_DIR");
    }
    const buf = fs.readFileSync(path.join(tempDir, "hoge.txt"));
    return new TextDecoder().decode(buf);
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRenderer.invoke("SHOW_AUDIO_SAVE_DIALOG", { title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRenderer.invoke("SHOW_OPEN_DIRECOTRY_DIALOG", { title });
  },

  showProjectSaveDialog: ({ title }) => {
    return ipcRenderer.invoke("SHOW_PROJECT_SAVE_DIALOG", { title });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRenderer.invoke("SHOW_PROJECT_LOAD_DIALOG", { title });
  },

  showConfirmDialog: ({ title, message }) => {
    return ipcRenderer.invoke("SHOW_CONFIRM_DIALOG", { title, message });
  },

  showImportFileDialog: ({ title }) => {
    return ipcRenderer.invoke("SHOW_IMPORT_FILE_DIALOG", { title });
  },

  writeFile: ({ filePath, buffer }) => {
    fs.writeFileSync(filePath, new DataView(buffer));
  },

  readFile: ({ filePath }) => {
    return fs.promises.readFile(filePath);
  },

  createHelpWindow: () => {
    ipcRenderer.invoke("CREATE_HELP_WINDOW");
  },

  openTextEditContextMenu: () => {
    return ipcRenderer.invoke("OPEN_TEXT_EDIT_CONTEXT_MENU");
  },

  updateMenu: (uiLocked: boolean) => {
    ipcRenderer.invoke("UPDATE_MENU", uiLocked);
  },

  onReceivedIPCMsg: (channel, callback) => {
    return ipcRenderer.on(channel, (event, argv) => callback(event, argv));
  },
};

contextBridge.exposeInMainWorld("electron", api);
