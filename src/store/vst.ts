import { Notify } from "quasar";
import { createPartialStore } from "./vuex";
import { exportProject } from "@/backend/vst/ipc";
import { VstStoreState, VstStoreTypes } from "@/store/type";
import { NOTIFY_TIMEOUT } from "@/components/Dialog/Dialog";
import { projectFilePath } from "@/backend/vst/sandbox";

export const vstStoreState: VstStoreState = {};

export const vstStore = createPartialStore<VstStoreTypes>({
  VST_EXPORT_PROJECT: {
    action: async ({ commit, dispatch }) => {
      commit("SET_PROJECT_FILEPATH", { filePath: projectFilePath });
      await dispatch("SAVE_PROJECT_FILE", {
        overwrite: true,
      });

      const result = await exportProject();
      if (result === "cancelled") {
        return;
      } else if (result === "error") {
        dispatch("SHOW_ALERT_DIALOG", {
          title: "エクスポートに失敗しました",
          // TODO: ちゃんとエラーメッセージを取得する。大体EBUSYなのでそれを表示する
          message: "他のアプリケーションがファイルを使用中の可能性があります",
        });
      } else {
        Notify.create({
          message: "エクスポートが完了しました",
          color: "toast",
          textColor: "toast-display",
          icon: "info",
          timeout: NOTIFY_TIMEOUT,
          actions: [
            {
              label: "閉じる",
              color: "toast-button-display",
            },
          ],
        });
      }
    },
  },
});
