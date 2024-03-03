import { onMounted, onActivated, onDeactivated, onUnmounted } from "vue";

/**
 * 描画時に１回だけ実行する処理を登録する。
 * 描画結果を破棄するときに実行する処理も登録できる。
 *
 * @param startup 描画時に実行する処理。"notNow"を返した場合は次のタイミングまで実行を遅延する。
 * @param cleanup 描画結果を破棄するときに実行する処理。
 *
 * NOTE:
 * 非表示状態でonMountedが呼ばれたり、onMountedとonActivatedの両方が呼ばれたり片方だけ呼ばれたりすることがある。
 * この関数はそのような場合でも必ず１回だけ必要な処理を実行できる。
 */
export const useOnRendering = (
  startup: () => void | "notNow",
  cleanup?: () => void
) => {
  /** 今は何を待っている状態か。 */
  let state: "shouldStart" | "shouldClean" = "shouldStart";

  const call = () => {
    if (state === "shouldStart") {
      // hookが"notNow"を返した場合は次回のレンダリングまで実行を遅延する
      const val = startup();
      if (val !== "notNow") {
        state = "shouldClean";
      }
    }
  };
  onMounted(call);
  onActivated(call);

  const stop = () => {
    if (state === "shouldClean") {
      if (cleanup != undefined) {
        cleanup();
      }
      state = "shouldStart";
    }
  };
  onDeactivated(stop);
  onUnmounted(stop);
};
