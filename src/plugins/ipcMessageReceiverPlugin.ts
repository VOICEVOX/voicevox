import { Plugin } from "vue";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { debounce } from "quasar";

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
      options.store.dispatch("DETECT_MAXIMIZED")
    );

    window.electron.onReceivedIPCMsg("DETECT_UNMAXIMIZED", () =>
      options.store.dispatch("DETECT_UNMAXIMIZED")
    );

    window.electron.onReceivedIPCMsg(
      "DETECTED_ENGINE_ERROR",
      (_, { engineId }) =>
        options.store.dispatch("DETECTED_ENGINE_ERROR", { engineId })
    );

    window.electron.onReceivedIPCMsg("DETECT_PINNED", () => {
      options.store.dispatch("DETECT_PINNED");
    });

    window.electron.onReceivedIPCMsg("DETECT_UNPINNED", () => {
      options.store.dispatch("DETECT_UNPINNED");
    });

    window.electron.onReceivedIPCMsg("DETECT_ENTER_FULLSCREEN", () =>
      options.store.dispatch("DETECT_ENTER_FULLSCREEN")
    );

    window.electron.onReceivedIPCMsg("DETECT_LEAVE_FULLSCREEN", () =>
      options.store.dispatch("DETECT_LEAVE_FULLSCREEN")
    );

    window.electron.onReceivedIPCMsg("CHECK_EDITED_AND_NOT_SAVE", () => {
      options.store.dispatch("CHECK_EDITED_AND_NOT_SAVE");
    });

    window.electron.onReceivedIPCMsg(
      "DETECT_RESIZED",
      debounce(
        (_, { width, height }) =>
          window.dataLayer?.push({ event: "windowResize", width, height }),
        300
      )
    );
  },
};
