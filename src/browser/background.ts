import {
  getAppInfosImpl,
  getContactTextImpl,
  getHowToUseTextImpl,
  getOssCommunityInfosImpl,
  getOssLicensesImpl,
  getPolicyTextImpl,
  getPrivacyPolicyTextImpl,
  getQAndATextImpl,
  getUpdateInfosImpl,
} from "./backgroundImpl";
import type { MainToWorkerMessage } from "./type";
import type { IpcIHData } from "@/type/ipc";

type MessageReturnTypes = { [K in keyof IpcIHData]: IpcIHData[K]["return"] };

const typedPostMessage = <K extends keyof MessageReturnTypes>(
  message: MessageReturnTypes[K]
) => {
  postMessage(message);
};

onmessage = (e: MessageEvent<MainToWorkerMessage>) => {
  switch (e.data.type) {
    case "GET_APP_INFOS":
      return getAppInfosImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_TEMP_DIR":
      console.dir(e.data);
      postMessage({ type: e.data.type, return: [], eventId: e.data.eventId });
      break;
    case "GET_HOW_TO_USE_TEXT":
      return getHowToUseTextImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_POLICY_TEXT":
      return getPolicyTextImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_OSS_LICENSES":
      return getOssLicensesImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_UPDATE_INFOS":
      return getUpdateInfosImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_OSS_COMMUNITY_INFOS":
      return getOssCommunityInfosImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_CONTACT_TEXT":
      return getContactTextImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_Q_AND_A_TEXT":
      return getQAndATextImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    case "GET_PRIVACY_POLICY_TEXT":
      return getPrivacyPolicyTextImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
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
    case "THEME":
    case "ON_VUEX_READY":
    case "GET_SETTING":
    case "SET_SETTING":
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
      postMessage({ type: e.data.type, return: [], eventId: e.data.eventId });
      break;
  }
};
