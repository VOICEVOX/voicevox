import { Plugin } from "vue";
import { debounce } from "quasar";
import { Store } from "@/store/vuex";
import { AllActions, AllGetters, AllMutations, State } from "@/store/type";
import { IpcRendererOn } from "@/type/ipc";

// これを直接contextBridgeで渡そうとするとクローン不可で怒られるので、使う側に置く
const onReceivedIPCMsg = new Proxy({} as IpcRendererOn, {
  get:
    (_, channel: keyof IpcRendererOn) =>
    (listener: (event: unknown, ...args: unknown[]) => unknown) => {
      window.backend.onReceivedIPCMsg(channel, listener);
    },
});

export const ipcMessageReceiver: Plugin = {
  install: (
    _,
    options: { store: Store<State, AllGetters, AllActions, AllMutations> },
  ) => {
    onReceivedIPCMsg.LOAD_PROJECT_FILE((_, { filePath, confirm } = {}) =>
      options.store.dispatch("LOAD_PROJECT_FILE", { filePath, confirm }),
    );

    onReceivedIPCMsg.DETECT_MAXIMIZED(() =>
      options.store.dispatch("DETECT_MAXIMIZED"),
    );

    onReceivedIPCMsg.DETECT_UNMAXIMIZED(() =>
      options.store.dispatch("DETECT_UNMAXIMIZED"),
    );

    onReceivedIPCMsg.DETECTED_ENGINE_ERROR((_, { engineId }) =>
      options.store.dispatch("DETECTED_ENGINE_ERROR", { engineId }),
    );

    onReceivedIPCMsg.DETECT_PINNED(() => {
      void options.store.dispatch("DETECT_PINNED");
    });

    onReceivedIPCMsg.DETECT_UNPINNED(() => {
      void options.store.dispatch("DETECT_UNPINNED");
    });

    onReceivedIPCMsg.DETECT_ENTER_FULLSCREEN(() =>
      options.store.dispatch("DETECT_ENTER_FULLSCREEN"),
    );

    onReceivedIPCMsg.DETECT_LEAVE_FULLSCREEN(() =>
      options.store.dispatch("DETECT_LEAVE_FULLSCREEN"),
    );

    onReceivedIPCMsg.CHECK_EDITED_AND_NOT_SAVE((_, obj) => {
      void options.store.dispatch("CHECK_EDITED_AND_NOT_SAVE", obj);
    });

    onReceivedIPCMsg.DETECT_RESIZED(
      debounce(
        (_, { width, height }: { width: number; height: number }) =>
          window.dataLayer?.push({ event: "windowResize", width, height }),
        300,
      ),
    );
  },
};
