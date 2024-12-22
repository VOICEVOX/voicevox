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
      LOAD_PROJECT_FILE: (_, { filePath }) =>
        void options.store.actions.LOAD_PROJECT_FILE({
          type: "path",
          filePath,
        }),

      DETECT_MAXIMIZED: () => options.store.actions.DETECT_MAXIMIZED(),

      DETECT_UNMAXIMIZED: () => options.store.actions.DETECT_UNMAXIMIZED(),

      DETECTED_ENGINE_ERROR: (_, { engineId }) =>
        options.store.actions.DETECTED_ENGINE_ERROR({ engineId }),

      DETECT_PINNED: () => {
        void options.store.actions.DETECT_PINNED();
      },

      DETECT_UNPINNED: () => {
        void options.store.actions.DETECT_UNPINNED();
      },

      DETECT_ENTER_FULLSCREEN: () =>
        options.store.actions.DETECT_ENTER_FULLSCREEN(),

      DETECT_LEAVE_FULLSCREEN: () =>
        options.store.actions.DETECT_LEAVE_FULLSCREEN(),

      CHECK_EDITED_AND_NOT_SAVE: (_, obj) => {
        void options.store.actions.CHECK_EDITED_AND_NOT_SAVE(obj);
      },

      DETECT_RESIZED: debounce(
        (_, { width, height }: { width: number; height: number }) =>
          window.dataLayer?.push({ event: "windowResize", width, height }),
        300,
      ),
    });
  },
};
