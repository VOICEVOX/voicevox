import {
  getAppInfosImpl,
  getContactTextImpl,
  getHowToUseTextImpl,
  getOssCommunityInfosImpl,
  getOssLicensesImpl,
  getPolicyTextImpl,
  getPrivacyPolicyTextImpl,
  getQAndATextImpl,
  getSettingImpl,
  getTempDirImpl,
  getUpdateInfosImpl,
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
    case "GET_TEMP_DIR":
      return getTempDirImpl(e.data.args).then((v) =>
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
    case "SHOW_AUDIO_SAVE_DIALOG":
    case "SHOW_TEXT_SAVE_DIALOG":
    case "SHOW_VVPP_OPEN_DIALOG":
    case "SHOW_OPEN_DIRECTORY_DIALOG":
    case "SHOW_IMPORT_FILE_DIALOG":
    case "SHOW_PROJECT_SAVE_DIALOG":
    case "SHOW_PROJECT_LOAD_DIALOG":
    case "SHOW_MESSAGE_DIALOG":
    case "SHOW_QUESTION_DIALOG":
    case "SHOW_WARNING_DIALOG":
    case "SHOW_ERROR_DIALOG":
    case "OPEN_TEXT_EDIT_CONTEXT_MENU":
    case "IS_AVAILABLE_GPU_MODE":
    case "IS_MAXIMIZED_WINDOW":
    case "CLOSE_WINDOW":
    case "MINIMIZE_WINDOW":
    case "MAXIMIZE_WINDOW":
    case "LOG_ERROR":
    case "LOG_WARN":
    case "LOG_INFO":
    case "ENGINE_INFOS":
    case "RESTART_ENGINE_ALL":
    case "RESTART_ENGINE":
    case "OPEN_ENGINE_DIRECTORY":
    case "CHECK_FILE_EXISTS":
    case "CHANGE_PIN_WINDOW":
    case "HOTKEY_SETTINGS":
    case "GET_DEFAULT_HOTKEY_SETTINGS":
    case "GET_DEFAULT_TOOLBAR_SETTING":
      console.dir(e.data);
      postMessage({ type: type, return: [], eventId: e.data.eventId });
      break;
    case "THEME":
      return themeImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "ON_VUEX_READY":
      console.dir(e.data);
      postMessage({ type, return: [], eventId: e.data.eventId });
      break;
    case "GET_SETTING":
      return getSettingImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "SET_SETTING":
      return setSettingImpl(e.data.args).then((v) =>
        typedPostMessage(type, v, e.data.eventId)
      );
    case "SET_ENGINE_SETTING":
    case "SET_NATIVE_THEME":
    case "INSTALL_VVPP_ENGINE":
    case "UNINSTALL_VVPP_ENGINE":
    case "VALIDATE_ENGINE_DIR":
    case "RESTART_APP":
    case "JOIN_PATH":
    case "WRITE_FILE":
    case "READ_FILE":
      console.dir(e.data);
      postMessage({ type, return: [], eventId: e.data.eventId });
      break;
  }
};
