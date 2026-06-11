import type { Plugin } from "vue";
import { debounce } from "quasar";
import type { Store } from "@/store/vuex";
import type { AllActions, AllGetters, AllMutations, State } from "@/store/type";

export const ipcMessageReceiver: Plugin = {
  install: (
    _,
    options: { store: Store<State, AllGetters, AllActions, AllMutations> },
  ) => {
    window.backend.registerIpcHandler({
      loadProjectFile: ({ filePath }) =>
        void options.store.actions.LOAD_PROJECT_FILE({
          type: "path",
          filePath,
        }),

      detectMaximized: () => options.store.actions.DETECT_MAXIMIZED(),

      detectUnmaximized: () => options.store.actions.DETECT_UNMAXIMIZED(),

      detectedEngineError: ({ engineId }) =>
        options.store.actions.DETECTED_ENGINE_ERROR({ engineId }),

      detectPinned: () => {
        void options.store.actions.DETECT_PINNED();
      },

      detectUnpinned: () => {
        void options.store.actions.DETECT_UNPINNED();
      },

      detectEnterFullscreen: () =>
        options.store.actions.DETECT_ENTER_FULLSCREEN(),

      detectLeaveFullscreen: () =>
        options.store.actions.DETECT_LEAVE_FULLSCREEN(),

      checkEditedAndNotSave: (obj) => {
        void options.store.actions.CHECK_EDITED_AND_NOT_SAVE(obj);
      },

      detectResized: debounce(
        ({ width, height }: { width: number; height: number }) =>
          window.dataLayer?.push({ event: "windowResize", width, height }),
        300,
      ),
    });
  },
};
