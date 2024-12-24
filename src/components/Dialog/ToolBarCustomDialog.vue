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
                <div :class="button === 'EMPTY' ? 'radio-space' : 'radio'">
                  <BaseTooltip :label="usableButtonsDesc[button]">
                    <QBtn
                      unelevated
                      color="toolbar-button"
                      textColor="toolbar-button-display"
                      class="text-no-wrap text-bold"
                    >
                      {{ getToolbarButtonName(button) }}
                    </QBtn>
                  </BaseTooltip>
                </div>
              </template>
            </Draggable>
            <div class="preview-toolbar-drag-hint">
              ドラッグでボタンの並びを変更できます。
            </div>
          </QToolbar>
          <div class="container">
            <BaseScrollArea>
              <div class="inner">
                <h1 class="title">表示するボタン</h1>
                <div class="list">
                  <BaseRowCard
                    v-for="(desc, key) in usableButtonsDesc"
                    :key
                    :title="getToolbarButtonName(key)"
                    :description="desc"
                    clickable
                    tabindex="-1"
                    @click="toggleToolbarButtons(key)"
                  >
                    <BaseSwitch
                      :checked="toolbarButtons.includes(key)"
                      checkedLabel="表示する"
                      uncheckedLabel="表示しない"
                    />
                  </BaseRowCard>
                </div>
              </div>
            </BaseScrollArea>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch, Ref } from "vue";
import Draggable from "vuedraggable";
import BaseSwitch from "@/components/Base/BaseSwitch.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import BaseRowCard from "@/components/Base/BaseRowCard.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";
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
void window.backend.getDefaultToolbarSetting().then((setting) => {
  defaultSetting.push(...setting);
});

const toggleToolbarButtons = (key: ToolbarButtonTagType) => {
  if (toolbarButtons.value.includes(key)) {
    toolbarButtons.value.splice(toolbarButtons.value.indexOf(key), 1);
  } else {
    toolbarButtons.value.push(key);
  }
};

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
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "デフォルトに戻しますか？",
    message: "ツールバーをデフォルトに戻します。",
    actionName: "デフォルトに戻す",
  });
  if (result === "OK") {
    toolbarButtons.value = [...defaultSetting];
    selectedButton.value = toolbarButtons.value[0];
  }
};
const saveCustomToolbar = () => {
  void store.actions.SET_TOOLBAR_SETTING({
    data: [...toolbarButtons.value],
  });
};

const finishOrNotDialog = async () => {
  if (isChanged.value) {
    const result = await store.actions.SHOW_WARNING_DIALOG({
      title: "カスタマイズを終了しますか？",
      message:
        "保存せずに終了すると、カスタマイズは破棄されてリセットされます。",
      actionName: "終了する",
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
@use "@/styles/v2/variables" as newvars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as colors;

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
  gap: 8px;
}

.preview-toolbar-drag-hint {
  padding-top: 8px;
  padding-bottom: 8px;
}

.radio {
  & > .q-btn:hover {
    cursor: grab !important;
  }
}

.radio-space {
  @extend .radio;
  flex-grow: 1;

  & > .q-btn {
    color: transparent;
    width: 100%;
  }
}

.title {
  @include mixin.headline-1;
}

.container {
  // TODO: 親コンポーネントからheightを取得できないため一時的にcalcを使用、HelpDialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 164px);
  background-color: colors.$background;
}

.inner {
  margin: auto;
  max-width: 960px;
  padding: newvars.$padding-2;
  display: flex;
  flex-direction: column;
  gap: newvars.$gap-1;
}

.list {
  display: flex;
  flex-direction: column;
  gap: newvars.$gap-1;
}
</style>
