import { onMounted, onActivated, onDeactivated, onUnmounted } from "vue";

/**
 * 描画時に１回だけ実行する処理を登録する。
 * 描画結果を破棄するときに実行する処理も登録できる。
 *
 * @param startHook 描画時に実行する処理。"notNow"を返した場合は次のタイミングまで実行を遅延する。
 * @param cleanHook 描画結果を破棄するときに実行する処理。
 *
 * NOTE:
 * 非表示状態でonMountedが呼ばれたり、onMountedとonActivatedの両方が呼ばれたり片方だけ呼ばれたりすることがある。
 * この関数はそのような場合でも必ず１回だけ必要な処理を実行できる。
 */
export const useOnRendering = (
  startHook: () => void | "notNow",
  cleanHook?: () => void
) => {
  /** 今は何を待っている状態か。 */
  let state: "shouldStart" | "shouldClean" = "shouldStart";

  const start = () => {
    if (state === "shouldStart") {
      // hookが"notNow"を返した場合は次回のレンダリングまで実行を遅延する
      const val = startHook();
      if (val !== "notNow") {
        state = "shouldClean";
      }
    }
  };
  onMounted(start);
  onActivated(start);

  const clean = () => {
    if (state === "shouldClean") {
      if (cleanHook != undefined) {
        cleanHook();
      }
      state = "shouldStart";
    }
  };
  onDeactivated(clean);
  onUnmounted(clean);
};
