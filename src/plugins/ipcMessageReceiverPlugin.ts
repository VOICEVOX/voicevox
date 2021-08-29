import { LOAD_PROJECT_FILE } from "@/store/project";
import { App } from "vue";
import { Store } from "vuex";
import { DETECT_MAXIMIZED, DETECT_UNMAXIMIZED } from "@/store/ui";
import { DETECTED_ENGINE_ERROR, START_WAITING_ENGINE } from "@/store/audio";

export const ipcMessageReceiver = {
  install: (_: App, options: { store: Store<unknown> }): void => {
    window.electron.onReceivedIPCMsg(
      "LOAD_PROJECT_FILE",
      (_, { filePath, confirm } = {}) =>
        options.store.dispatch(LOAD_PROJECT_FILE, { filePath, confirm })
    );

    window.electron.onReceivedIPCMsg("DETECT_MAXIMIZED", () =>
      options.store.dispatch(DETECT_MAXIMIZED)
    );

    window.electron.onReceivedIPCMsg("DETECT_UNMAXIMIZED", () =>
      options.store.dispatch(DETECT_UNMAXIMIZED)
    );

    window.electron.onReceivedIPCMsg("DETECTED_ENGINE_ERROR", () =>
      options.store.dispatch(DETECTED_ENGINE_ERROR)
    );

    window.electron.onReceivedIPCMsg("START_WAITING_ENGINE", () => {
      options.store.dispatch(START_WAITING_ENGINE);
    });
  },
};
