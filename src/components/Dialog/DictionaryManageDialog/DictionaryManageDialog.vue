<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
    persistent
  >
    <QLayout>
      <QPageContainer>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"
              >読み方＆アクセント辞書</QToolbarTitle
            >
            <QSpace />
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              @click="closeDialog"
            />
          </QToolbar>
        </QHeader>
        <div v-if="loadingDictState" class="loading-dict">
          <div>
            <QSpinner color="primary" size="2.5rem" />
            <div class="q-mt-xs">
              <template v-if="loadingDictState === 'loading'"
                >読み込み中・・・</template
              >
              <template v-if="loadingDictState === 'synchronizing'"
                >同期中・・・</template
              >
            </div>
          </div>
        </div>
        <BaseNavigationView>
          <template #sidebar>
            <div class="list-header">
              <div class="list-title">単語一覧</div>
              <BaseButton
                label="追加"
                icon="add"
                :disabled="uiLocked"
                @click="selectNewWord"
              />
            </div>
            <div class="list">
              <BaseListItem
                v-for="(value, key) in userDict"
                :key
                :selected="
                  currentWord?.type === 'edit' && currentWord.id === key
                "
                @click="selectWordWithConfirmDialog(key)"
                @mouseover="hoveredKey = key"
                @mouseleave="hoveredKey = undefined"
              >
                <div class="listitem">
                  <div class="listitem-text">
                    <span class="listitem-surface">
                      {{ value.surface }}
                    </span>
                    <span class="listitem-yomi">
                      {{ value.yomi }}
                    </span>
                  </div>
                  <BaseIconButton
                    v-if="
                      hoveredKey === key ||
                      (currentWord?.type === 'edit' && currentWord.id === key)
                    "
                    icon="delete_outline"
                    label="削除"
                    :disabled="uiLocked"
                    @click.stop="deleteWord(key)"
                  />
                </div>
              </BaseListItem>
            </div>
          </template>

          <WordEditor
            v-if="currentWord?.type === 'edit'"
            ref="wordEditor"
            :key="`${currentWord.id}-${wordEditorNonce}`"
            :initialSurface="currentWord.surface"
            :initialYomi="currentWord.yomi"
            :initialWordPriority="currentWord.wordPriority"
            :initialAccentType="currentWord.accentType"
          />
          <WordEditor
            v-else-if="currentWord?.type === 'new'"
            ref="wordEditor"
            :key="`new-${wordEditorNonce}`"
            initialSurface=""
            initialYomi=""
            :initialWordPriority="5"
            :initialAccentType="0"
            isNew
            @saveNewWord="saveNewWord"
          />
        </BaseNavigationView>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { lockUiWhile, uiLocked } from "./common";
import WordEditor from "./WordEditor.vue";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import { useStore } from "@/store";
import type { UserDictWord } from "@/openapi";
import { UnreachableError } from "@/type/utility";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
const store = useStore();

const loadingDictState = ref<null | "loading" | "synchronizing">(null);
const hoveredKey = ref<string | undefined>(undefined);

// NOTE: 単語を移動したときにコンポーネントを作り直すために適当な数字をkeyに足す
const wordEditorNonce = ref(0);
const currentWord = ref<
  | {
      type: "edit";
      id: string;
      surface: string;
      yomi: string;
      accentType: number;
      wordPriority: number;
    }
  | {
      type: "new";
    }
  | null
>(null);
const userDict = ref<Record<string, UserDictWord>>({});

const saveEditedWord = async () => {
  if (currentWord.value?.type !== "edit")
    throw new UnreachableError("currentWord.value is not edit");
  if (!wordEditor.value)
    throw new UnreachableError("wordEditor is not defined");

  const { editState } = wordEditor.value;
  if (editState.type !== "valid") return;

  try {
    await lockUiWhile(
      store.actions.REWRITE_WORD({
        wordUuid: currentWord.value.id,
        surface: editState.surface,
        pronunciation: editState.yomi,
        accentType: editState.accentType,
        priority: editState.wordPriority,
      }),
    );
    userDict.value[currentWord.value.id] = {
      ...userDict.value[currentWord.value.id],
      surface: editState.surface,
      yomi: editState.yomi,
      accentType: editState.accentType,
      priority: editState.wordPriority,
    };
    currentWord.value = {
      type: "edit",
      id: currentWord.value.id,
      surface: editState.surface,
      yomi: editState.yomi,
      accentType: editState.accentType,
      wordPriority: editState.wordPriority,
    };
  } catch (e) {
    void store.actions.SHOW_ALERT_DIALOG({
      title: "単語の更新に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    window.backend.logError(e);
    return false;
  }
  return true;
};

const saveNewWord = async () => {
  if (currentWord.value?.type !== "new")
    throw new UnreachableError("currentWord.value is not new");
  if (!wordEditor.value)
    throw new UnreachableError("wordEditor is not defined");

  const { editState } = wordEditor.value;
  if (editState.type !== "valid") return;

  try {
    const wordUuid = await lockUiWhile(
      store.actions.ADD_WORD({
        surface: editState.surface,
        pronunciation: editState.yomi,
        accentType: editState.accentType,
        priority: editState.wordPriority,
      }),
    );
    await loadUserDict();
    selectWord(wordUuid);
  } catch (e) {
    void store.actions.SHOW_ALERT_DIALOG({
      title: "単語の登録に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    window.backend.logError(e);
    return;
  }
};

const beforeMove = async (proceed: () => void) => {
  if (currentWord.value == null) {
    proceed();
    return;
  }
  if (!wordEditor.value)
    throw new UnreachableError("wordEditor is not defined");
  if (wordEditor.value.editState.type === "unchanged") {
    proceed();
    return;
  }

  // 単語の追加時は手動保存のため警告を表示する。
  // 単語の変更時は、変更内容が有効でない場合は破棄されるので警告を表示する。
  if (currentWord.value.type === "new") {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "単語の追加を破棄しますか？",
      message: "変更を破棄すると、単語の追加はリセットされます。",
      actionName: "破棄する",
      cancel: "破棄しない",
      isWarningColorButton: true,
    });
    if (result === "OK") {
      wordEditorNonce.value++;
      proceed();
    }
  } else if (wordEditor.value.editState.type === "invalid") {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "単語の変更をキャンセルしますか？",
      message: "変更を破棄すると、現在の編集内容はリセットされます。",
      actionName: "破棄する",
      cancel: "破棄しない",
      isWarningColorButton: true,
    });
    if (result === "OK") {
      wordEditorNonce.value++;
      proceed();
    }
  } else {
    // 変更内容が有効であるなら自動保存する
    const saved = await saveEditedWord();
    if (!saved) return;
    proceed();
  }
};

const selectNewWord = () => {
  void beforeMove(() => {
    currentWord.value = {
      type: "new",
    };
  });
};
const selectWordWithConfirmDialog = (id: string) => {
  void beforeMove(() => {
    selectWord(id);
  });
};
const selectWord = (id: string) => {
  const word = userDict.value[id];
  currentWord.value = {
    type: "edit",
    id,
    surface: word.surface,
    yomi: word.yomi,
    accentType: word.accentType,
    wordPriority: word.priority,
  };
};

const loadUserDict = async () => {
  if (store.state.engineIds.length === 0)
    throw new Error(`assert engineId.length > 0`);

  loadingDictState.value = "loading";
  try {
    userDict.value = await lockUiWhile(store.actions.LOAD_ALL_USER_DICT());
  } catch {
    loadingDictState.value = null;
    const result = await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の取得に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    if (result === "OK") {
      dialogOpened.value = false;
    }
    return;
  }
  loadingDictState.value = "synchronizing";
  try {
    await lockUiWhile(store.actions.SYNC_ALL_USER_DICT());
  } catch {
    await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の同期に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
  }
  loadingDictState.value = null;
};

watch(
  dialogOpened,
  async (newValue) => {
    if (newValue) {
      await loadUserDict();
      currentWord.value = null;
    }
  },
  {
    immediate: true,
  },
);

const wordEditor = ref<InstanceType<typeof WordEditor>>();

const deleteWord = async (id: string) => {
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除する",
    isWarningColorButton: true,
    cancel: "削除しない",
  });
  if (result === "OK") {
    try {
      await lockUiWhile(
        store.actions.DELETE_WORD({
          wordUuid: id,
        }),
      );
      if (currentWord.value?.type === "edit" && currentWord.value.id === id) {
        currentWord.value = null;
      }
    } catch {
      void store.actions.SHOW_ALERT_DIALOG({
        title: "単語の削除に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
    await loadUserDict();
  }
};
const closeDialog = () => {
  void beforeMove(() => {
    dialogOpened.value = false;
  });
};
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;

.list-header {
  display: flex;
  gap: vars.$gap-1;
  align-items: center;
  justify-content: space-between;
  margin-bottom: vars.$padding-1;
}

.list-title {
  @include mixin.headline-2;
}

.list {
  display: flex;
  flex-direction: column;
  width: 240px;
}

.listitem {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
  width: 100%;
}

.listitem-text {
  display: flex;
  flex-direction: column;
  align-items: start;
  overflow: hidden;
  margin-right: auto;
}

.listitem-surface {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.listitem-yomi {
  width: 100%;
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loading-dict {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$background;
    border-radius: 6px;
    padding: 14px;
  }
}
</style>
