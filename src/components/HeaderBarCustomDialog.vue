<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="header-bar-custom-dialog transparent-backdrop"
    v-model="headerBarCustomDialogOpenComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container class="root">
        <q-header class="q-py-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display"
              >ツールバーのカスタマイズ</q-toolbar-title
            >
            <q-space />
            <q-btn
              unelevated
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap text-bold q-mr-sm"
              @click="applyDefaultSetting"
              :disable="isDefault"
              >デフォルトに戻す</q-btn
            >
            <q-btn
              unelevated
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap text-bold q-mr-sm"
              @click="saveCustomToolbar"
              :disable="!isChanged"
              >保存</q-btn
            >
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="finishOrNotDialog"
            />
          </q-toolbar>
        </q-header>
        <q-page>
          <q-card flat square class="preview-card">
            <q-toolbar class="bg-toolbar preview-toolbar">
              <template v-for="button in toolbarButtons" :key="button">
                <q-radio
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="getToolbarButtonName(button)"
                  :class="
                    (button === 'EMPTY'
                      ? selectedButton === button
                        ? 'radio-space-selected'
                        : 'radio-space'
                      : selectedButton === button
                      ? 'radio-selected'
                      : 'radio') +
                    ' text-no-wrap text-bold text-display q-mr-sm'
                  "
                  ><q-tooltip
                    :delay="800"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    >{{ usableButtonsDesc[button] }}</q-tooltip
                  ></q-radio
                >
              </template>
            </q-toolbar>
            <q-card-actions class="no-wrap text-no-wrap">
              <div v-if="selectedButton !== undefined" class="text-h5">
                「{{ getToolbarButtonName(selectedButton) }}」を選択中
              </div>
              <q-space />
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="!leftShiftable"
                @click="moveLeftButton"
                >左に動かす</q-btn
              >
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="!rightShiftable"
                @click="moveRightButton"
                >右に動かす</q-btn
              >
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="!removable"
                @click="removeButton"
                >削除する</q-btn
              >
            </q-card-actions>
            <q-card-actions>
              <div class="text-h5">表示するボタンの選択</div>
            </q-card-actions>
            <q-card-actions class="no-padding">
              <q-list class="usable-button-list bg-surface">
                <q-item
                  v-for="(desc, key) in usableButtonsDesc"
                  :key="key"
                  tag="label"
                  v-ripple
                >
                  <q-item-section>
                    <q-item-label>{{ getToolbarButtonName(key) }}</q-item-label>
                    <q-item-label caption>{{ desc }}</q-item-label>
                  </q-item-section>
                  <q-item-section avatar>
                    <q-toggle v-model="toolbarButtons" :val="key" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-card-actions>
          </q-card>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch, Ref } from "vue";
import { useStore } from "@/store";
import { ToolbarButtonTagType, ToolbarSetting } from "@/type/preload";
import { useQuasar } from "quasar";
import { getToolbarButtonName } from "@/store/utility";

export default defineComponent({
  name: "HeaderBarCustomDialog",
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();
    const $q = useQuasar();

    // computedだと値の編集ができないが、refにすると起動時に読み込まれる設定が反映されないので、watchしている
    const toolbarButtons = ref([...store.state.toolbarSetting]);
    const selectedButton: Ref<ToolbarButtonTagType | undefined> = ref(
      toolbarButtons.value[0]
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
      }
    );

    const defaultSetting: ToolbarSetting = [];
    window.electron.getDefaultToolbarSetting().then((setting) => {
      defaultSetting.push(...setting);
    });

    const usableButtonsDesc: Record<ToolbarButtonTagType, string> = {
      PLAY_CONTINUOUSLY:
        "選択されているテキスト以降のすべてのテキストを読み上げます。",
      STOP: "テキストが読み上げられているときに、それを止めます。",
      EXPORT_AUDIO_ONE:
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

    const headerBarCustomDialogOpenComputed = computed({
      get: () => props.modelValue || isChanged.value,
      set: (val) => emit("update:modelValue", val),
    });

    const leftShiftable = computed(
      () => selectedButton.value !== toolbarButtons.value[0] && removable.value
    );
    const rightShiftable = computed(
      () =>
        selectedButton.value !==
          toolbarButtons.value[toolbarButtons.value.length - 1] &&
        removable.value
    );
    const removable = computed(() => selectedButton.value !== undefined);

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

    const moveLeftButton = () => {
      if (selectedButton.value === undefined) return;
      const index = toolbarButtons.value.indexOf(selectedButton.value);
      toolbarButtons.value[index] = toolbarButtons.value[index - 1];
      toolbarButtons.value[index - 1] = selectedButton.value;
    };
    const moveRightButton = () => {
      if (selectedButton.value === undefined) return;
      const index = toolbarButtons.value.indexOf(selectedButton.value);
      toolbarButtons.value[index] = toolbarButtons.value[index + 1];
      toolbarButtons.value[index + 1] = selectedButton.value;
    };
    const removeButton = () => {
      if (selectedButton.value === undefined) return;
      const index = toolbarButtons.value.indexOf(selectedButton.value);
      toolbarButtons.value = [
        ...toolbarButtons.value.slice(0, index),
        ...toolbarButtons.value.slice(index + 1),
      ];
    };

    // ボタンが追加されたときはそれをフォーカスし、
    // 削除されたときは一番最初のボタンをフォーカスするようにする
    watch(
      () => toolbarButtons.value,
      (newData, oldData) => {
        if (oldData.length < newData.length) {
          selectedButton.value = newData[newData.length - 1];
        } else if (
          selectedButton.value !== undefined &&
          oldData.includes(selectedButton.value) &&
          !newData.includes(selectedButton.value)
        ) {
          selectedButton.value = newData[0];
        }
      }
    );

    const applyDefaultSetting = () => {
      $q.dialog({
        title: "ツールバーをデフォルトに戻します",
        message: "ツールバーをデフォルトに戻します。<br/>よろしいですか？",
        html: true,
        ok: {
          label: "はい",
          flat: true,
          textColor: "display",
        },
        cancel: {
          label: "いいえ",
          flat: true,
          textColor: "display",
        },
      }).onOk(() => {
        toolbarButtons.value = [...defaultSetting];
        selectedButton.value = toolbarButtons.value[0];
      });
    };
    const saveCustomToolbar = () => {
      store.dispatch("SET_TOOLBAR_SETTING", {
        data: [...toolbarButtons.value],
      });
    };

    const finishOrNotDialog = () => {
      if (isChanged.value) {
        $q.dialog({
          title: "カスタマイズを終了しますか？",
          message:
            "このまま終了すると、カスタマイズは破棄されてリセットされます。",
          persistent: true,
          focus: "cancel",
          ok: {
            label: "終了",
            flat: true,
            textColor: "display",
          },
          cancel: {
            label: "キャンセル",
            flat: true,
            textColor: "display",
          },
        }).onOk(() => {
          toolbarButtons.value = [...store.state.toolbarSetting];
          selectedButton.value = toolbarButtons.value[0];
          headerBarCustomDialogOpenComputed.value = false;
        });
      } else {
        selectedButton.value = toolbarButtons.value[0];
        headerBarCustomDialogOpenComputed.value = false;
      }
    };

    return {
      headerBarCustomDialogOpenComputed,
      toolbarButtons,
      selectedButton,
      leftShiftable,
      rightShiftable,
      removable,
      isChanged,
      isDefault,
      moveLeftButton,
      moveRightButton,
      removeButton,
      saveCustomToolbar,
      usableButtonsDesc,
      getToolbarButtonName,
      applyDefaultSetting,
      finishOrNotDialog,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.header-bar-custom-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  overflow-x: hidden;

  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.preview-toolbar {
  height: vars.$header-height;
}

.preview-card {
  width: 100%;
  min-width: 460px;
  background: var(--color-background);
}

.usable-button-list {
  // menubar-height + header-height * 2(main+preview) + window-border-width
  // 52(preview part buttons) * 2 + 46(select part title)
  height: calc(
    100vh - #{vars.$menubar-height + (vars.$header-height * 2) +
      vars.$window-border-width + 52px + 46px}
  );
  width: 100%;
  overflow-y: scroll;
}

.radio {
  padding: 6px 14px;
  border: solid 2px var(--color-toolbar-button);
  border-radius: 3px;
  color: var(--color-toolbar-button-display);
  background-color: var(--color-toolbar-button);
}

.radio:hover {
  @extend .radio-selected;
}

.radio-selected {
  @extend .radio;
  padding-top: 10px;
  padding-bottom: 10px;
  margin-bottom: 10px;
}

.radio-space {
  @extend .radio;
  flex-grow: 1;
  color: transparent;
}

.radio-space:hover {
  @extend .radio-space-selected;
}

.radio-space-selected {
  @extend .radio-space;
  padding-top: 10px;
  padding-bottom: 10px;
  margin-bottom: 10px;
}
</style>
