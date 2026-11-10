import type { DeepReadonly } from "vue";
import type { AllMutations, State } from "@/store/type";
import type { DotNotationCommit } from "@/store/vuex";
import type { EditorType } from "@/type/preload";

/**
 * Undo/Redoのパッチ適用の前後に実行する処理。
 *
 * パッチ適用前に呼ばれ、パッチ適用後に実行する関数を返す。
 * パッチはstateをその場で書き換えるため、beforeとafterは同じオブジェクトを指す。
 * パッチ適用前の値は、パッチ適用前の呼び出しの中でコピーして、返す関数に保持する。
 *
 * パッチは記録時のstateの内容を前提に適用される。
 * この前提を保つため、stateは読み取り専用で渡し、書き込みは型引数Mで列挙したmutationに限定する。
 */
export type UndoRedoHook<M extends keyof AllMutations> = (
  before: DeepReadonly<State>,
) => (
  after: DeepReadonly<State>,
  mutations: Pick<DotNotationCommit<AllMutations>, M>,
) => void;

const noHook: UndoRedoHook<never> = () => () => undefined;

// TODO: 存在しないノートのみ選択解除、あるいはSELECTED_NOTE_IDS getterを作る
const deselectAllNotes: UndoRedoHook<"DESELECT_ALL_NOTES"> =
  () => (_, mutations) => {
    mutations.DESELECT_ALL_NOTES();
  };

export const undoRedoHooks: Record<
  EditorType,
  UndoRedoHook<keyof AllMutations>
> = {
  talk: noHook,
  song: deselectAllNotes,
};
