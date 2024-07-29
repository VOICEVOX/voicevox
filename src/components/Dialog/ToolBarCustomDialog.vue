<template>
  <QDialog
    v-model="ToolBarCustomDialogOpenComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="tool-bar-custom-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer class="root">
        <QHeader class="q-py-sm">
          <QToolbar>
            <QToolbarTitle class="text-display"
              >ツールバーのカスタマイズ</QToolbarTitle
            >
            <QSpace />
            <QBtn
              unelevated
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap text-bold q-mr-sm"
              :disable="isDefault"
              @click="applyDefaultSetting"
              >デフォルトに戻す</QBtn
            >
            <QBtn
              unelevated
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap text-bold q-mr-sm"
              :disable="!isChanged"
              @click="saveCustomToolbar"
              >保存</QBtn
            >
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              @click="finishOrNotDialog"
            />
          </QToolbar>
        </QHeader>
        <QPage>
          <QCard flat square class="preview-card">
            <QToolbar class="bg-toolbar preview-toolbar">
              <Draggable
                v-model="toolbarButtons"
                :itemKey="toolbarButtonKey"
                @start="toolbarButtonDragging = true"
                @end="toolbarButtonDragging = false"
              >
                <template
                  #item="{ element: button }: { element: ToolbarButtonTagType }"
                >
                  <QBtn
                    unelevated
                    color="toolbar-button"
                    textColor="toolbar-button-display"
                    :class="
                      (button === 'EMPTY' ? ' radio-space' : ' radio') +
                      ' text-no-wrap text-bold q-mr-sm'
                    "
                  >
                    {{ getToolbarButtonName(button) }}
                    <QTooltip
                      :delay="800"
                      anchor="center right"
                      self="center left"
                      transitionShow="jump-right"
                      transitionHide="jump-left"
                      :style="{
                        display: toolbarButtonDragging ? 'none' : 'block',
                      }"
                      >{{ usableButtonsDesc[button] }}</QTooltip
                    >
                  </QBtn>
                </template>
              </Draggable>
              <div class="preview-toolbar-drag-hint">
                ドラッグでボタンの並びを変更できます。
              </div>
            </QToolbar>

            <QCardActions>
              <div class="text-h5">表示するボタンの選択</div>
            </QCardActions>
            <QCardActions class="no-padding">
              <QList class="usable-button-list bg-surface">
                <QItem
                  v-for="(desc, key) in usableButtonsDesc"
                  :key
                  v-ripple
                  tag="label"
                >
                  <QItemSection>
                    <QItemLabel>{{ getToolbarButtonName(key) }}</QItemLabel>
                    <QItemLabel caption>{{ desc }}</QItemLabel>
                  </QItemSection>
                  <QItemSection avatar>
                    <QToggle v-model="toolbarButtons" :val="key" />
                  </QItemSection>
                </QItem>
              </QList>
            </QCardActions>
          </QCard>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, Ref } from "vue";
import Draggable from "vuedraggable";
import { useStore } from "@/store";
import { ToolbarButtonTagType, ToolbarSettingType } from "@/type/preload";
import { getToolbarButtonName } from "@/store/utility";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();

// computedだと値の編集ができないが、refにすると起動時に読み込まれる設定が反映されないので、watchしている
const toolbarButtons = ref([...store.state.toolbarSetting]);
const toolbarButtonKey = (button: ToolbarButtonTagType) => button;
const toolbarButtonDragging = ref(false);
const selectedButton: Ref<ToolbarButtonTagType | undefined> = ref(
  toolbarButtons.value[0],
);
watch(
  () => store.state.toolbarSetting,
  (newData) => {
    // このwatchはToolbar Setting更新時にも機能するが、
    // 以下の処理はVOICEVOX起動時のみ機能してほしいので、toolbarButtonsのlengthが0の時だけ機能させる
    if (!toolbarButtons.value.length) {
      toolbarButtons.value = [...newData];
      selectedButton.value = newData[0];
    }
  },
);

const defaultSetting: ToolbarSettingType = [];
window.backend.getDefaultToolbarSetting().then((setting) => {
  defaultSetting.push(...setting);
});

const usableButtonsDesc: Record<ToolbarButtonTagType, string> = {
  PLAY_CONTINUOUSLY:
    "選択されているテキスト以降のすべてのテキストを読み上げます。",
  STOP: "テキストが読み上げられているときに、それを止めます。",
  EXPORT_AUDIO_SELECTED:
    "選択されているテキストの読み上げを音声ファイルに書き出します。",
  EXPORT_AUDIO_ALL:
    "入力されているすべてのテキストの読み上げを音声ファイルに書き出します。",
  EXPORT_AUDIO_CONNECT_ALL:
    "入力されているすべてのテキストの読み上げを一つの音声ファイルに繋げて書き出します。",
  SAVE_PROJECT: "プロジェクトを上書き保存します。",
  UNDO: "操作を一つ戻します。",
  REDO: "元に戻した操作をやり直します。",
  IMPORT_TEXT: "テキストファイル(.txt)を読み込みます。",
  EMPTY:
    "これはボタンではありません。レイアウトの調整に使います。また、実際には表示されません。",
};

const ToolBarCustomDialogOpenComputed = computed({
  get: () => props.modelValue || isChanged.value,
  set: (val) => emit("update:modelValue", val),
});

const isChanged = computed(() => {
  const nowSetting = store.state.toolbarSetting;
  return (
    toolbarButtons.value.length != nowSetting.length ||
    toolbarButtons.value.some((e, i) => e != nowSetting[i])
  );
});
const isDefault = computed(() => {
  return (
    toolbarButtons.value.length == defaultSetting.length &&
    toolbarButtons.value.every((e, i) => e == defaultSetting[i])
  );
});

// ボタンが追加されたときはそれをフォーカスし、
// 削除されたときは一番最初のボタンをフォーカスするようにする
watch(
  () => toolbarButtons.value,
  (newData, oldData) => {
    if (oldData.length < newData.length) {
      selectedButton.value = newData[newData.length - 1];
    } else if (
      selectedButton.value != undefined &&
      oldData.includes(selectedButton.value) &&
      !newData.includes(selectedButton.value)
    ) {
      selectedButton.value = newData[0];
    }
  },
);

const applyDefaultSetting = async () => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "ツールバーをデフォルトに戻します",
    message: "ツールバーをデフォルトに戻します。<br/>よろしいですか？",
    html: true,
    actionName: "はい",
    cancel: "いいえ",
  });
  if (result === "OK") {
    toolbarButtons.value = [...defaultSetting];
    selectedButton.value = toolbarButtons.value[0];
  }
};
const saveCustomToolbar = () => {
  store.dispatch("SET_TOOLBAR_SETTING", {
    data: [...toolbarButtons.value],
  });
};

const finishOrNotDialog = async () => {
  if (isChanged.value) {
    const result = await store.dispatch("SHOW_WARNING_DIALOG", {
      title: "カスタマイズを終了しますか？",
      message:
        "保存せずに終了すると、カスタマイズは破棄されてリセットされます。",
      actionName: "終了",
    });
    if (result === "OK") {
      toolbarButtons.value = [...store.state.toolbarSetting];
      selectedButton.value = toolbarButtons.value[0];
      ToolBarCustomDialogOpenComputed.value = false;
    }
  } else {
    selectedButton.value = toolbarButtons.value[0];
    ToolBarCustomDialogOpenComputed.value = false;
  }
};
</script>

<style lang="scss" scoped>
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.tool-bar-custom-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  overflow-x: hidden;

  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.preview-toolbar {
  height: calc(#{vars.$toolbar-height} + 8px);
  display: block;
}

// draggableのdiv。
.preview-toolbar > div:not(.preview-toolbar-drag-hint) {
  width: 100%;
  display: inline-flex;
}

.preview-toolbar-drag-hint {
  padding-top: 8px;
  padding-bottom: 8px;
}

.preview-card {
  width: 100%;
  min-width: 460px;
  background: var(--color-background);
}

.usable-button-list {
  // menubar-height + toolbar-height * 2(main+preview) + window-border-width
  // 52(preview part buttons) * 2 + 46(select part title) + 22(preview part hint)
  height: calc(
    100vh - #{vars.$menubar-height + (vars.$toolbar-height) +
      vars.$window-border-width + 52px + 46px + 22px}
  );
  width: 100%;
  overflow-y: scroll;
}

.radio {
  &:hover {
    cursor: grab;
  }
}

.radio-space {
  @extend .radio;
  flex-grow: 1;
  color: transparent;
}
</style>
