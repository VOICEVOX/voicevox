import { IpcSOData } from "@/type/ipc";
import {
  ElectronStoreType,
  EngineId,
  EngineSetting,
  HotkeySetting,
  NativeThemeType,
  SandboxKey,
} from "@/type/preload";

const worker = new Worker(new URL("./background.ts", import.meta.url));

export const api: typeof window[typeof SandboxKey] = {
  getAppInfos() {
    throw new Error("Not Implemented");
  },
  getHowToUseText() {
    throw new Error("Not Implemented");
  },
  getPolicyText() {
    throw new Error("Not Implemented");
  },
  getOssLicenses() {
    throw new Error("Not Implemented");
  },
  getUpdateInfos() {
    throw new Error("Not Implemented");
  },
  getOssCommunityInfos() {
    throw new Error("Not Implemented");
  },
  getQAndAText() {
    throw new Error("Not Implemented");
  },
  getContactText() {
    throw new Error("Not Implemented");
  },
  getPrivacyPolicyText() {
    throw new Error("Not Implemented");
  },
  getAltPortInfos() {
    throw new Error("Not Implemented");
  },
  saveTempAudioFile(obj: { relativePath: string; buffer: ArrayBuffer }) {
    throw new Error("Not Implemented");
  },
  loadTempFile() {
    throw new Error("Not Implemented");
  },
  showAudioSaveDialog(obj: { title: string; defaultPath?: string }) {
    throw new Error("Not Implemented");
  },
  showTextSaveDialog(obj: { title: string; defaultPath?: string }) {
    throw new Error("Not Implemented");
  },
  showVvppOpenDialog(obj: { title: string; defaultPath?: string }) {
    throw new Error("Not Implemented");
  },
  showOpenDirectoryDialog(obj: { title: string }) {
    throw new Error("Not Implemented");
  },
  showProjectSaveDialog(obj: { title: string; defaultPath?: string }) {
    throw new Error("Not Implemented");
  },
  showProjectLoadDialog(obj: { title: string }) {
    throw new Error("Not Implemented");
  },
  showMessageDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
  }) {
    throw new Error("Not Implemented");
  },
  showQuestionDialog(obj: {
    type: "none" | "info" | "error" | "question" | "warning";
    title: string;
    message: string;
    buttons: string[];
    cancelId?: number;
    defaultId?: number;
  }) {
    throw new Error("Not Implemented");
  },
  showImportFileDialog(obj: { title: string }) {
    throw new Error("Not Implemented");
  },
  writeFile(obj: { filePath: string; buffer: ArrayBuffer }) {
    throw new Error("Not Implemented");
  },
  readFile(obj: { filePath: string }) {
    throw new Error("Not Implemented");
  },
  openTextEditContextMenu() {
    throw new Error("Not Implemented");
  },
  isAvailableGPUMode() {
    throw new Error("Not Implemented");
  },
  isMaximizedWindow() {
    throw new Error("Not Implemented");
  },
  onReceivedIPCMsg<T extends keyof IpcSOData>(
    channel: T,
    listener: (_: unknown, ...args: IpcSOData[T]["args"]) => void
  ) {
    console.dir(`channel: ${channel}, listener: ${listener}`);
    window.addEventListener("message", (event) => {
      if (event.data.channel === channel) {
        listener(event.data.args);
      }
    });
  },
  closeWindow() {
    throw new Error("Not Implemented");
  },
  minimizeWindow() {
    throw new Error("Not Implemented");
  },
  maximizeWindow() {
    throw new Error("Not Implemented");
  },
  logError(...params: unknown[]) {
    throw new Error("Not Implemented");
  },
  logWarn(...params: unknown[]) {
    throw new Error("Not Implemented");
  },
  logInfo(...params: unknown[]) {
    throw new Error("Not Implemented");
  },
  engineInfos() {
    throw new Error("Not Implemented");
  },
  restartEngine(engineId: EngineId) {
    throw new Error("Not Implemented");
  },
  openEngineDirectory(engineId: EngineId) {
    throw new Error("Not Implemented");
  },
  hotkeySettings(newData?: HotkeySetting) {
    throw new Error("Not Implemented");
  },
  checkFileExists(file: string) {
    throw new Error("Not Implemented");
  },
  changePinWindow() {
    throw new Error("Not Implemented");
  },
  getDefaultHotkeySettings() {
    throw new Error("Not Implemented");
  },
  getDefaultToolbarSetting() {
    throw new Error("Not Implemented");
  },
  setNativeTheme(source: NativeThemeType) {
    throw new Error("Not Implemented");
  },
  theme(newData?: string) {
    throw new Error("Not Implemented");
  },
  vuexReady() {
    throw new Error("Not Implemented");
  },
  getSetting<Key extends keyof ElectronStoreType>(key: Key) {
    throw new Error("Not Implemented");
  },
  setSetting<Key extends keyof ElectronStoreType>(
    key: Key,
    newValue: ElectronStoreType[Key]
  ) {
    throw new Error("Not Implemented");
  },
  setEngineSetting(engineId: EngineId, engineSetting: EngineSetting) {
    throw new Error("Not Implemented");
  },
  installVvppEngine(path: string) {
    throw new Error("Not Implemented");
  },
  uninstallVvppEngine(engineId: EngineId) {
    throw new Error("Not Implemented");
  },
  validateEngineDir(engineDir: string) {
    throw new Error("Not Implemented");
  },
  restartApp(obj: { isMultiEngineOffMode: boolean }) {
    throw new Error("Not Implemented");
  },
};
