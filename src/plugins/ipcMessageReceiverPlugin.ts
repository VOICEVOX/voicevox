import { Plugin } from "vue";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";

export const ipcMessageReceiver: Plugin = {
  install: (
    _,
    options: { store: Store<State, AllGetters, AllActions, AllMutations> }
  ) => {
    window.electron.onReceivedIPCMsg(
      "LOAD_PROJECT_FILE",
      (_, { filePath, confirm } = {}) =>
        options.store.dispatch("LOAD_PROJECT_FILE", { filePath, confirm })
    );

    window.electron.onReceivedIPCMsg("DETECT_MAXIMIZED", () =>
      options.store.dispatch("DETECT_MAXIMIZED", undefined)
    );

    window.electron.onReceivedIPCMsg("DETECT_UNMAXIMIZED", () =>
      options.store.dispatch("DETECT_UNMAXIMIZED", undefined)
    );

    window.electron.onReceivedIPCMsg("DETECTED_ENGINE_ERROR", () =>
      options.store.dispatch("DETECTED_ENGINE_ERROR", undefined)
    );

    window.electron.onReceivedIPCMsg("DETECT_PINNED", () => {
      options.store.dispatch("DETECT_PINNED", undefined);
    });

    window.electron.onReceivedIPCMsg("DETECT_UNPINNED", () => {
      options.store.dispatch("DETECT_UNPINNED", undefined);
    });
  },
};
