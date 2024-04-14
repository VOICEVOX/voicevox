import { Plugin } from "vue";
import { debounce } from "quasar";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";

export const ipcMessageReceiver: Plugin = {
  install: (
    _,
    options: { store: Store<State, AllGetters, AllActions, AllMutations> }
  ) => {
    window.backend.onReceivedIPCMsg(
      "LOAD_PROJECT_FILE",
      (_, { filePath, confirm } = {}) =>
        options.store.dispatch("LOAD_PROJECT_FILE", { filePath, confirm })
    );

    window.backend.onReceivedIPCMsg("DETECT_MAXIMIZED", () =>
      options.store.dispatch("DETECT_MAXIMIZED")
    );

    window.backend.onReceivedIPCMsg("DETECT_UNMAXIMIZED", () =>
      options.store.dispatch("DETECT_UNMAXIMIZED")
    );

    window.backend.onReceivedIPCMsg(
      "DETECTED_ENGINE_ERROR",
      (_, { engineId }) =>
        options.store.dispatch("DETECTED_ENGINE_ERROR", { engineId })
    );

    window.backend.onReceivedIPCMsg("DETECT_PINNED", () => {
      options.store.dispatch("DETECT_PINNED");
    });

    window.backend.onReceivedIPCMsg("DETECT_UNPINNED", () => {
      options.store.dispatch("DETECT_UNPINNED");
    });

    window.backend.onReceivedIPCMsg("DETECT_ENTER_FULLSCREEN", () =>
      options.store.dispatch("DETECT_ENTER_FULLSCREEN")
    );

    window.backend.onReceivedIPCMsg("DETECT_LEAVE_FULLSCREEN", () =>
      options.store.dispatch("DETECT_LEAVE_FULLSCREEN")
    );

    window.backend.onReceivedIPCMsg("CHECK_EDITED_AND_NOT_SAVE", (_, obj) => {
      options.store.dispatch("CHECK_EDITED_AND_NOT_SAVE", obj);
    });

    window.backend.onReceivedIPCMsg(
      "DETECT_RESIZED",
      debounce(
        (_, { width, height }) =>
          window.dataLayer?.push({ event: "windowResize", width, height }),
        300
      )
    );
  },
};
