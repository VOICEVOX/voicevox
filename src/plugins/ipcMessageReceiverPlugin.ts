import { Plugin } from "vue";
import { debounce } from "quasar";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";

export const ipcMessageReceiver: Plugin = {
  install: (
    _,
    options: { store: Store<State, AllGetters, AllActions, AllMutations> },
  ) => {
    window.backend.onReceivedIPCMsg({
      LOAD_PROJECT_FILE: (_, { filePath, confirm } = {}) =>
        void options.store.dispatch("LOAD_PROJECT_FILE", { filePath, confirm }),

      DETECT_MAXIMIZED: () => options.store.dispatch("DETECT_MAXIMIZED"),

      DETECT_UNMAXIMIZED: () => options.store.dispatch("DETECT_UNMAXIMIZED"),

      DETECTED_ENGINE_ERROR: (_, { engineId }) =>
        options.store.dispatch("DETECTED_ENGINE_ERROR", { engineId }),

      DETECT_PINNED: () => {
        void options.store.dispatch("DETECT_PINNED");
      },

      DETECT_UNPINNED: () => {
        void options.store.dispatch("DETECT_UNPINNED");
      },

      DETECT_ENTER_FULLSCREEN: () =>
        options.store.dispatch("DETECT_ENTER_FULLSCREEN"),

      DETECT_LEAVE_FULLSCREEN: () =>
        options.store.dispatch("DETECT_LEAVE_FULLSCREEN"),

      CHECK_EDITED_AND_NOT_SAVE: (_, obj) => {
        void options.store.dispatch("CHECK_EDITED_AND_NOT_SAVE", obj);
      },

      DETECT_RESIZED: debounce(
        (_, { width, height }: { width: number; height: number }) =>
          window.dataLayer?.push({ event: "windowResize", width, height }),
        300,
      ),
    });
  },
};
