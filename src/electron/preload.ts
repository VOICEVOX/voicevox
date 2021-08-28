import {
  contextBridge,
  ipcRenderer,
  IpcRenderer,
  IpcRendererEvent,
} from "electron";
import fs from "fs";
import path from "path";

import { Sandbox } from "@/type/preload";

function ipcRendererInvoke<T extends keyof IpcIHData>(
  channel: T,
  ...args: IpcIHData[T]["args"]
): Promise<IpcIHData[T]["return"]>;
function ipcRendererInvoke(channel: string, ...args: unknown[]): unknown {
  return ipcRenderer.invoke(channel, ...args);
}

function ipcRendererOn<T extends keyof IpcSOData>(
  channel: T,
  listener: (event: IpcRendererEvent, ...args: IpcSOData[T]["args"]) => void
): IpcRenderer;
function ipcRendererOn(
  channel: string,
  listener: (event: IpcRendererEvent, ...args: unknown[]) => void
) {
  return ipcRenderer.on(channel, listener);
}

let tempDir: string;

const api: Sandbox = {
  getAppInfos: async () => {
    return await ipcRendererInvoke("GET_APP_INFOS");
  },

  getCharacterInfos: async () => {
    return await ipcRendererInvoke("GET_CHARACTER_INFOS");
  },

  getPolicyText: async () => {
    return await ipcRendererInvoke("GET_POLICY_TEXT");
  },

  getOssLicenses: async () => {
    return await ipcRendererInvoke("GET_OSS_LICENSES");
  },

  getUpdateInfos: async () => {
    return await ipcRendererInvoke("GET_UPDATE_INFOS");
  },

  saveTempAudioFile: async ({ relativePath, buffer }) => {
    if (!tempDir) {
      tempDir = await ipcRendererInvoke("GET_TEMP_DIR");
    }
    fs.writeFileSync(path.join(tempDir, relativePath), new DataView(buffer));
  },

  loadTempFile: async () => {
    if (!tempDir) {
      tempDir = await ipcRendererInvoke("GET_TEMP_DIR");
    }
    const buf = fs.readFileSync(path.join(tempDir, "hoge.txt"));
    return new TextDecoder().decode(buf);
  },

  showAudioSaveDialog: ({ title, defaultPath }) => {
    return ipcRendererInvoke("SHOW_AUDIO_SAVE_DIALOG", { title, defaultPath });
  },

  showOpenDirectoryDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_OPEN_DIRECTORY_DIALOG", { title });
  },

  showProjectSaveDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_PROJECT_SAVE_DIALOG", { title });
  },

  showProjectLoadDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_PROJECT_LOAD_DIALOG", { title });
  },

  showConfirmDialog: ({ title, message }) => {
    return ipcRendererInvoke("SHOW_CONFIRM_DIALOG", { title, message });
  },

  showWarningDialog: ({ title, message }) => {
    return ipcRendererInvoke("SHOW_WARNING_DIALOG", { title, message });
  },

  showErrorDialog: ({ title, message }) => {
    return ipcRendererInvoke("SHOW_ERROR_DIALOG", { title, message });
  },

  showImportFileDialog: ({ title }) => {
    return ipcRendererInvoke("SHOW_IMPORT_FILE_DIALOG", { title });
  },

  writeFile: ({ filePath, buffer }) => {
    fs.writeFileSync(filePath, new DataView(buffer));
  },

  readFile: ({ filePath }) => {
    return fs.promises.readFile(filePath);
  },

  openTextEditContextMenu: () => {
    return ipcRendererInvoke("OPEN_TEXT_EDIT_CONTEXT_MENU");
  },

  useGpu: (newValue) => {
    return ipcRendererInvoke("USE_GPU", { newValue });
  },

  isAvailableGPUMode: () => {
    return ipcRendererInvoke("IS_AVAILABLE_GPU_MODE");
  },

  fileEncoding: (newValue) => {
    return ipcRendererInvoke("FILE_ENCODING", { newValue });
  },

  onReceivedIPCMsg: (channel, callback) => {
    return ipcRendererOn(channel, callback);
  },

  closeWindow: () => {
    ipcRenderer.invoke("CLOSE_WINDOW");
  },

  minimizeWindow: () => {
    ipcRenderer.invoke("MINIMIZE_WINDOW");
  },

  maximizeWindow: () => {
    ipcRenderer.invoke("MAXIMIZE_WINDOW");
  },

  captureError: ({ error, stack }) => {
    return ipcRenderer.invoke("CAPTURE_ERROR", { error, stack });
  },
};

contextBridge.exposeInMainWorld("electron", api);
