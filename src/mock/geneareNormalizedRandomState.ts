import { State } from "@/store/type";
import { AudioKey } from "@/type/preload";

function generateIncrementalUuid(index: number) {
  return `00000000-0000-0000-0000-${index.toString().padStart(12, "0")}`;
}

/** Stateのランダムな部分を正規化する便利関数。テスト用。 */
export function geneareNormalizedRandomState(state: State) {
  // これだと入れ替えたときとかにテストできない
  // ので、やっぱりrandomUuidを使う側をmockにしたい
  // globalにステートを作って、reset関数を１個まとめてあげる形がまるそう
  // どうやって１箇所に集めるかは課題
  // フォルダ名storybookに戻しても良さそう

  // AudioKey
  const oldAudioKeys = state.audioKeys;
  const newAudioKeys = oldAudioKeys.map((_, index) =>
    AudioKey(generateIncrementalUuid(index)),
  );
  state.audioItems = Object.fromEntries(
    oldAudioKeys.map((oldKey, index) => [
      newAudioKeys[index],
      state.audioItems[oldKey],
    ]),
  );
  state.audioKeys = newAudioKeys;
}
