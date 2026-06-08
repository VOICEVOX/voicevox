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
                @click="resetInputs"
              />
            </div>
            <div class="list">
              <BaseListItem
                v-for="(value, key) in userDict"
                :key
                :selected="selectedWordId === key"
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
                    v-if="hoveredKey === key || selectedWordId === key"
                    icon="delete_outline"
                    label="削除"
                    @click.stop="deleteWord(key)"
                  />
                </div>
              </BaseListItem>
            </div>
          </template>

          <WordEditor
            ref="editWordDialog"
            v-model:surface="surface"
            v-model:yomi="yomi"
            v-model:wordPriority="wordPriority"
            :uiLocked
            @reset="resetInputs"
          />
        </BaseNavigationView>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { uiLocked } from "./common";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import WordEditor from "./WordEditor.vue";

const defaultDictPriority = 5;

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });

const loadingDictState = ref<null | "loading" | "synchronizing">(null);
const hoveredKey = ref<string | undefined>(undefined);
const selectedWordId = ref<string | undefined>(undefined);
const userDict = ref({
  example1: {
    surface: "アクセント",
    yomi: "アクセント",
  },
  example2: {
    surface: "読み方",
    yomi: "ヨミカタ",
  },
});

const surface = ref("");
const yomi = ref("");
const wordPriority = ref(defaultDictPriority);
const editWordDialog = ref<InstanceType<typeof WordEditor>>();

const resetInputs = () => {
  selectedWordId.value = undefined;
  surface.value = "";
  yomi.value = "";
  wordPriority.value = 5;
  void nextTick(() => {
    editWordDialog.value?.focusSurfaceInput();
  });
};
const selectWord = (id: keyof typeof userDict.value) => {
  selectedWordId.value = id;
  surface.value = userDict.value[id].surface;
  yomi.value = userDict.value[id].yomi;
};
const deleteWord = (id: keyof typeof userDict.value) => {
  if (selectedWordId.value === id) {
    resetInputs();
  }
};
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
