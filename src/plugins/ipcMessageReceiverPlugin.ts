import { LOAD_PROJECT_FILE } from "@/store";
import { App } from "vue";
import { Store } from "vuex";

export const ipcMessageReceiver = {
  install: (_: App, options: { store: Store<unknown> }): void => {
    window.electron.onReceivedIPCMsg(
      "LOAD_PROJECT_FILE",
      (_, { filePath, confirm } = {}) =>
        options.store.dispatch(LOAD_PROJECT_FILE, { filePath, confirm })
    );
  },
};
