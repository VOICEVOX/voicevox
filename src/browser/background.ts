import {
  engineInfosImpl,
  getAltPortInfosImpl,
  getAppInfosImpl,
  getContactTextImpl,
  getDefaultHotkeySettingsImpl,
  getDefaultToolbarSettingImpl,
  getHowToUseTextImpl,
  getOssCommunityInfosImpl,
  getOssLicensesImpl,
  getPolicyTextImpl,
  getPrivacyPolicyTextImpl,
  getQAndATextImpl,
  getSettingImpl,
  getUpdateInfosImpl,
  hotkeySettingsImpl,
  isAvailableGpuModeImpl,
  isMaximizedWindowImpl,
  logErrorImpl,
  logInfoImpl,
  logWarnImpl,
  onVuexReadyImpl,
  openTextEditContextMenuImpl,
  setEngineSettingImpl,
  setSettingImpl,
  themeImpl,
} from "./backgroundImpl";
import type { MainToWorkerMessage } from "./type";
import type { IpcIHData } from "@/type/ipc";

type MessageReturnTypes = { [K in keyof IpcIHData]: IpcIHData[K]["return"] };

const typedPostMessage = <K extends keyof MessageReturnTypes>(
  type: K,
  message: MessageReturnTypes[K],
  eventId: string
) => {
  postMessage({ type, return: message, eventId });
};

onmessage = (e: MessageEvent<MainToWorkerMessage>) => {
  const type = e.data.type;
  switch (type) {
    case "GET_APP_INFOS":
      return getAppInfosImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_HOW_TO_USE_TEXT":
      return getHowToUseTextImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_POLICY_TEXT":
      return getPolicyTextImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_OSS_LICENSES":
      return getOssLicensesImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_UPDATE_INFOS":
      return getUpdateInfosImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_OSS_COMMUNITY_INFOS":
      return getOssCommunityInfosImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_CONTACT_TEXT":
      return getContactTextImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_Q_AND_A_TEXT":
      return getQAndATextImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_PRIVACY_POLICY_TEXT":
      return getPrivacyPolicyTextImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_ALT_PORT_INFOS":
      return getAltPortInfosImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "OPEN_TEXT_EDIT_CONTEXT_MENU":
      return openTextEditContextMenuImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "IS_AVAILABLE_GPU_MODE":
      return isAvailableGpuModeImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "IS_MAXIMIZED_WINDOW":
      return isMaximizedWindowImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "LOG_ERROR":
      return logErrorImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "LOG_WARN":
      return logWarnImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "LOG_INFO":
      return logInfoImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "ENGINE_INFOS":
      return engineInfosImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "HOTKEY_SETTINGS":
      return hotkeySettingsImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_DEFAULT_HOTKEY_SETTINGS":
      return getDefaultHotkeySettingsImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_DEFAULT_TOOLBAR_SETTING":
      return getDefaultToolbarSettingImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "THEME":
      return themeImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "ON_VUEX_READY":
      return onVuexReadyImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "GET_SETTING":
      return getSettingImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "SET_SETTING":
      return setSettingImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "SET_ENGINE_SETTING":
      return setEngineSettingImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    default:
      throw new Error(`Not implemented: ${type}`);
  }
};
