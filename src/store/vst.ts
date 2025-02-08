import { createPartialStore } from "./vuex";
import { exportProject } from "@/backend/vst/ipc";
import { VstStoreState, VstStoreTypes } from "@/store/type";
import { notifyResult } from "@/components/Dialog/Dialog";
import { projectFilePath } from "@/backend/vst/sandbox";

export const vstStoreState: VstStoreState = {};

export const vstStore = createPartialStore<VstStoreTypes>({
  VST_EXPORT_PROJECT: {
    action: async ({ actions, state, commit, dispatch }) => {
      commit("SET_PROJECT_FILEPATH", { filePath: projectFilePath });
      await dispatch("SAVE_PROJECT_FILE", {
        overwrite: true,
      });

      const result = await exportProject();
      if (result === "cancelled") {
        return;
      } else if (result === "error") {
        void dispatch("SHOW_ALERT_DIALOG", {
          title: "エクスポートに失敗しました",
          // TODO: ちゃんとエラーメッセージを取得する。大体EBUSYなのでそれを表示する
          message: "他のアプリケーションがファイルを使用中の可能性があります",
        });
      } else {
        notifyResult(
          {
            path: undefined,
            result: "SUCCESS",
          },
          "project",
          actions,
          state.confirmedTips.notifyOnGenerate,
        );
      }
    },
  },
});
