import { computed, Ref, ref, watch } from "vue";
import { QInput } from "quasar";
import {
  convertHiraToKana,
  convertLongVowel,
  createKanaRegex,
} from "@/domain/japanese";
import { AccentPhrase } from "@/openapi";
import { useStore } from "@/store";
import { UserDictWord } from "@/openapi";

export function useDictionaryDialog(
  wordEditing: boolean,
  selectedId: string,
  surface: Ref<string>,
  uiLocked: Ref<boolean>,
  yomi?: string,
  accentPhrase?: AccentPhrase | undefined,
  surfaceInput?: Ref<QInput | undefined>,
) {
  const kanaRegex = createKanaRegex();
  const isOnlyHiraOrKana = ref(true);
  const store = useStore();
  const loadingDictState = ref<null | "loading" | "synchronizing">("loading");
  const userDict = ref<Record<string, UserDictWord>>({});
  const defaultDictPriority = 5;
  const wordPriority = ref(defaultDictPriority);

  const props = defineProps<{
    modelValue: boolean;
  }>();
  const emit = defineEmits<{
    (e: "update:modelValue", v: boolean): void;
  }>();

  const dictionaryManageDialogOpenedComputed = computed({
    get: () => props.modelValue,
    set: (val) => emit("update:modelValue", val),
  });

  watch(dictionaryManageDialogOpenedComputed, async (newValue) => {
    if (newValue) {
      await loadingDictProcess();
      toInitialState();
    }
  });

  const setYomi = async (text: string, changeWord?: boolean) => {
    const { engineId, styleId } = voiceComputed.value;

    // テキスト長が0の時にエラー表示にならないように、テキスト長を考慮する
    isOnlyHiraOrKana.value = !text.length || kanaRegex.test(text);
    // 読みが変更されていない場合は、アクセントフレーズに変更を加えない
    // ただし、読みが同じで違う単語が存在する場合が考えられるので、changeWordフラグを考慮する
    // 「ガ」が自動挿入されるので、それを考慮してsliceしている
    if (
      text ==
        accentPhrase?.moras
          .map((v) => v.text)
          .join("")
          .slice(0, -1) &&
      !changeWord
    ) {
      return;
    }
    if (isOnlyHiraOrKana.value && text.length) {
      text = convertHiraToKana(text);
      text = convertLongVowel(text);
      accentPhrase = (
        await createUILockAction(
          store.dispatch("FETCH_ACCENT_PHRASES", {
            text: text + "ガ'",
            engineId,
            styleId,
            isKana: true,
          }),
        )
      )[0];
      if (selectedId && userDict.value[selectedId].yomi === text) {
        accentPhrase.accent = computeDisplayAccent();
      }
    } else {
      accentPhrase = undefined;
    }
    yomi = text;
  };

  const createUILockAction = function <T>(action: Promise<T>) {
    uiLocked.value = true;
    return action.finally(() => {
      uiLocked.value = false;
    });
  };

  const voiceComputed = computed(() => {
    const userOrderedCharacterInfos =
      store.getters.USER_ORDERED_CHARACTER_INFOS("talk");
    if (userOrderedCharacterInfos == undefined)
      throw new Error("assert USER_ORDERED_CHARACTER_INFOS");
    if (store.state.engineIds.length === 0)
      throw new Error("assert engineId.length > 0");
    const characterInfo = userOrderedCharacterInfos[0].metas;
    const speakerId = characterInfo.speakerUuid;
    const { engineId, styleId } = characterInfo.styles[0];
    return { engineId, speakerId, styleId };
  });

  const loadingDictProcess = async () => {
    if (store.state.engineIds.length === 0)
      throw new Error(`assert engineId.length > 0`);

    loadingDictState.value = "loading";
    try {
      userDict.value = await createUILockAction(
        store.dispatch("LOAD_ALL_USER_DICT"),
      );
    } catch {
      const result = await store.dispatch("SHOW_ALERT_DIALOG", {
        title: "辞書の取得に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      if (result === "OK") {
        dictionaryManageDialogOpenedComputed.value = false;
      }
    }
    loadingDictState.value = "synchronizing";
    try {
      await createUILockAction(store.dispatch("SYNC_ALL_USER_DICT"));
    } catch {
      await store.dispatch("SHOW_ALERT_DIALOG", {
        title: "辞書の同期に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
    }
    loadingDictState.value = null;
  };

  // computeの逆
  // 辞書から得たaccentが0の場合に、自動で追加される「ガ」の位置にアクセントを表示させるように処理する
  const computeDisplayAccent = () => {
    if (!accentPhrase || !selectedId) throw new Error();
    let accent = userDict.value[selectedId].accentType;
    accent = accent === 0 ? accentPhrase.moras.length : accent;
    return accent;
  };

  // accent phraseにあるaccentと実際に登録するアクセントには差が生まれる
  // アクセントが自動追加される「ガ」に指定されている場合、
  // 実際に登録するaccentの値は0となるので、そうなるように処理する
  const computeRegisteredAccent = () => {
    if (!accentPhrase) throw new Error();
    let accent = accentPhrase.accent;
    accent = accent === accentPhrase.moras.length ? 0 : accent;
    return accent;
  };

  // 操作（ステートの移動）
  const isWordChanged = computed(() => {
    if (selectedId === "") {
      return surface.value && yomi && accentPhrase;
    }
    // 一旦代入することで、userDictそのものが更新された時もcomputedするようにする
    const dict = userDict.value;
    const dictData = dict[selectedId];
    return (
      dictData &&
      (dictData.surface !== surface.value ||
        dictData.yomi !== yomi ||
        dictData.accentType !== computeRegisteredAccent() ||
        dictData.priority !== wordPriority.value)
    );
  });

  const discardOrNotDialog = async (okCallback: () => void) => {
    if (isWordChanged.value) {
      const result = await store.dispatch("SHOW_WARNING_DIALOG", {
        title: "単語の追加・変更を破棄しますか？",
        message: "破棄すると、単語の追加・変更はリセットされます。",
        actionName: "破棄",
      });
      if (result === "OK") {
        okCallback();
      }
    } else {
      okCallback();
    }
  };

  const cancel = () => {
    toInitialState();
  };

  // ステートの移動
  // 初期状態
  const toInitialState = () => {
    wordEditing = false;
    selectedId = "";
    surface.value = "";
    void setYomi("");
    wordPriority.value = defaultDictPriority;
  };

  // 単語が選択されているだけの状態
  const toWordSelectedState = () => {
    wordEditing = false;
  };

  // 単語が編集されている状態
  const toWordEditingState = () => {
    wordEditing = true;
    surfaceInput?.value?.focus();
  };

  // ダイアログが閉じている状態
  const toDialogClosedState = () => {
    dictionaryManageDialogOpenedComputed.value = false;
  };

  return {
    dictionaryManageDialogOpenedComputed,
    wordPriority,
    userDict,
    voiceComputed,
    isWordChanged,
    setYomi,
    createUILockAction,
    loadingDictProcess,
    computeRegisteredAccent,
    discardOrNotDialog,
    cancel,
    toInitialState,
    toWordSelectedState,
    toWordEditingState,
    toDialogClosedState,
  };
}
