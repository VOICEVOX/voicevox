import { LOAD_PROJECT_FILE } from "@/store/project";
import { Plugin } from "vue";
import { Store } from "vuex";
import {
  DETECT_MAXIMIZED,
  DETECT_PINNED,
  DETECT_UNMAXIMIZED,
  DETECT_UNPINNED,
} from "@/store/ui";
import { DETECTED_ENGINE_ERROR, START_WAITING_ENGINE } from "@/store/audio";
import { State } from "@/store/type";

export const ipcMessageReceiver: Plugin = {
  install: (_, options: { store: Store<State> }) => {
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

    window.electron.onReceivedIPCMsg("DETECT_PINNED", () => {
      options.store.dispatch(DETECT_PINNED);
    });

    window.electron.onReceivedIPCMsg("DETECT_UNPINNED", () => {
      options.store.dispatch(DETECT_UNPINNED);
    });
  },
};
