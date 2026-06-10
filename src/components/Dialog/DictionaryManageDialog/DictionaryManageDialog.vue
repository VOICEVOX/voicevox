<template>
  <QDialog
    v-model="dialogOpened"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
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
                @click="selectWord(key)"
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
                    @click.stop="deleteWord(key)"
                  />
                </div>
              </BaseListItem>
            </div>
          </template>

          <WordEditor
            v-if="currentWord?.type === 'edit'"
            ref="editWordDialog"
            :key="currentWord.id"
            :initialSurface="currentWord.surface"
            :initialYomi="currentWord.yomi"
            :initialWordPriority="currentWord.wordPriority"
          />
          <WordEditor
            v-else-if="currentWord?.type === 'new'"
            ref="editWordDialog"
            initialSurface=""
            initialYomi=""
            :initialWordPriority="5"
            isNew
          />
        </BaseNavigationView>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { lockUiWhile, uiLocked } from "./common";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import WordEditor from "./WordEditor.vue";
import { useStore } from "@/store";
import type { UserDictWord } from "@/openapi/models/UserDictWord";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
const store = useStore();

const loadingDictState = ref<null | "loading" | "synchronizing">(null);
const hoveredKey = ref<string | undefined>(undefined);
const currentWord = ref<
  | {
      type: "edit";
      id: string;
      surface: string;
      yomi: string;
      wordPriority: number;
    }
  | {
      type: "new";
    }
  | null
>(null);
const userDict = ref<Record<string, UserDictWord>>({});

const selectNewWord = () => {
  // TODO: 新しい単語から遷移するときは変更検知して警告を出す、既存の単語のときは保存する
  currentWord.value = {
    type: "new",
  };
};
const selectWord = (id: string) => {
  // TODO: 新しい単語から遷移するときは変更検知して警告を出す、既存の単語のときは保存する
  const word = userDict.value[id];
  if (!word) return;
  currentWord.value = {
    type: "edit",
    id,
    surface: word.surface,
    yomi: word.yomi,
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
    const result = await store.actions.SHOW_ALERT_DIALOG({
      title: "辞書の取得に失敗しました",
      message: "エンジンの再起動をお試しください。",
    });
    if (result === "OK") {
      dialogOpened.value = false;
    }
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

watch(dialogOpened, async (newValue) => {
  if (newValue) {
    await loadUserDict();
  }
});


const editWordDialog = ref<InstanceType<typeof WordEditor>>();

const deleteWord = (id: keyof typeof userDict.value) => {};
const closeDialog = () => {
  dialogOpened.value = false;
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
