<template>
  <QDialog
    v-model="dictionaryManageDialogOpenedComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
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
              :disable="wordEditing"
              @click="discardOrNotDialog(closeDialog)"
            />
          </QToolbar>
        </QHeader>
        <QPage class="row">
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
          <div class="col-4 word-list-col">
            <div
              v-if="wordEditing"
              class="word-list-disable-overlay"
              @click="discardOrNotDialog(cancel)"
            />
            <div class="word-list-header text-no-wrap">
              <div class="row word-list-title">
                <span class="text-h5 col-8">単語一覧</span>
                <QBtn
                  outline
                  textColor="display"
                  class="text-no-wrap text-bold col"
                  :disable="uiLocked"
                  @click="newWord"
                  >追加</QBtn
                >
              </div>
            </div>
            <QList class="word-list">
              <QItem
                v-for="(value, key) in userDict"
                :key
                v-ripple
                tag="label"
                clickable
                :active="selectedId === key"
                activeClass="active-word"
                @click="selectWord(key)"
                @dblclick="editWord"
                @mouseover="hoveredKey = key"
                @mouseleave="hoveredKey = undefined"
              >
                <QItemSection>
                  <QItemLabel lines="1" class="text-display">{{
                    value.surface
                  }}</QItemLabel>
                  <QItemLabel lines="1" caption>{{ value.yomi }}</QItemLabel>
                </QItemSection>

                <QItemSection
                  v-if="!uiLocked && (hoveredKey === key || selectedId === key)"
                  side
                >
                  <div class="q-gutter-xs">
                    <QBtn
                      size="12px"
                      flat
                      dense
                      round
                      icon="edit"
                      @click.stop="
                        selectWord(key);
                        editWord();
                      "
                    >
                      <QTooltip :delay="500">編集</QTooltip>
                    </QBtn>
                    <QBtn
                      size="12px"
                      flat
                      dense
                      round
                      icon="delete_outline"
                      @click.stop="
                        selectWord(key);
                        deleteWord();
                      "
                    >
                      <QTooltip :delay="500">削除</QTooltip>
                    </QBtn>
                  </div>
                </QItemSection>
              </QItem>
            </QList>
          </div>

          <DictionaryEditWordDialog :wordEditing :selectedId />
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DictionaryEditWordDialog from "./DictionaryEditWordDialog.vue";
import { useDictionaryDialog } from "@/composables/useDictionaryDialog";
import { useStore } from "@/store";

const defaultDictPriority = 5;
const store = useStore();
const uiLocked = ref(false); // ダイアログ内でstore.getters.UI_LOCKEDは常にtrueなので独自に管理
const hoveredKey = ref<string | undefined>(undefined); // word-list の要素のうち、どの要素がホバーされているか
const loadingDictState = ref<null | "loading" | "synchronizing">("loading");
const wordEditing = ref(false);
const selectedId = ref("");
const surface = ref("");
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

const deleteWord = async () => {
  const result = await store.dispatch("SHOW_WARNING_DIALOG", {
    title: "登録された単語を削除しますか？",
    message: "削除された単語は元に戻せません。",
    actionName: "削除",
  });
  if (result === "OK") {
    try {
      await createUILockAction(
        store.dispatch("DELETE_WORD", {
          wordUuid: selectedId.value,
        }),
      );
    } catch {
      void store.dispatch("SHOW_ALERT_DIALOG", {
        title: "単語の削除に失敗しました",
        message: "エンジンの再起動をお試しください。",
      });
      return;
    }
    await loadingDictProcess();
    toInitialState();
  }
};

const newWord = () => {
  selectedId.value = "";
  surface.value = "";
  void setYomi("");
  wordPriority.value = defaultDictPriority;
  editWord();
};

const editWord = () => {
  toWordEditingState();
};

const selectWord = (id: string) => {
  selectedId.value = id;
  surface.value = userDict.value[id].surface;
  void setYomi(userDict.value[id].yomi, true);
  wordPriority.value = userDict.value[id].priority;
  toWordSelectedState();
};

const closeDialog = () => {
  dictionaryManageDialogOpenedComputed.value = false;
};

const {
  userDict,
  setYomi,
  createUILockAction,
  loadingDictProcess,
  discardOrNotDialog,
  cancel,
  toInitialState,
  toWordSelectedState,
  toWordEditingState,
} = useDictionaryDialog(
  wordEditing,
  selectedId,
  surface,
  uiLocked,
  dictionaryManageDialogOpenedComputed,
);
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

.word-list-col {
  border-right: solid 1px colors.$surface;
  position: relative; // オーバーレイのため
  overflow-x: hidden;
}

.word-list-header {
  margin: 1rem;

  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  .word-list-title {
    flex-grow: 1;
  }
}

.word-list {
  // menubar-height + toolbar-height + window-border-width +
  // 36(title & buttons) + 30(margin 15x2)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width + 36px + 30px}
  );
  width: 100%;
  overflow-y: auto;
  padding-bottom: 16px;
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
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

.word-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}
</style>
