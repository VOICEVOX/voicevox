<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="header-bar-custom-dialog"
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
              color="background-light"
              text-color="display-dark"
              class="text-no-wrap text-bold q-mr-sm"
              @click="saveCustomToolbar"
              :disable="!changedOrNotFlag"
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
            <q-toolbar class="bg-primary preview-toolbar">
              <template v-for="button in toolbarButtons" :key="button">
                <q-radio
                  v-if="button === 'EMPTY'"
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="button"
                  :class="
                    (selectedButton === button
                      ? 'radio-space-selected'
                      : 'radio-space') + ' text-no-wrap q-mr-sm'
                  "
                  ><q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    >{{ usableButtonsDesc[button] }}</q-tooltip
                  ></q-radio
                >
                <q-radio
                  v-else
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="button"
                  :class="
                    (selectedButton === button ? 'radio-selected' : 'radio') +
                    ' text-no-wrap text-bold text-display q-mr-sm'
                  "
                  ><q-tooltip
                    :delay="500"
                    anchor="center left"
                    self="center right"
                    transition-show="jump-left"
                    transition-hide="jump-right"
                    >{{ usableButtonsDesc[button] }}</q-tooltip
                  ></q-radio
                >
              </template>
            </q-toolbar>
            <q-card-actions>
              <div class="text-h5">「{{ selectedButton }}」を</div>
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
                @click="removeButton"
                >削除する</q-btn
              >
            </q-card-actions>
            <q-card-actions>
              <div class="text-h5">表示するボタンの選択</div>
            </q-card-actions>
            <q-card-actions class="no-padding">
              <q-list class="usable-button-list">
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
import { computed, defineComponent, ref, watch } from "vue";
import { useStore } from "@/store";
import { ToolbarButtonTagType } from "@/type/preload";
import { getToolbarButtonName } from "@/components/HeaderBar.vue";
import { useQuasar } from "quasar";

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
    const toolbarButtons = ref([...store.state.toolbarSetting.buttons]);
    const selectedButton = ref(toolbarButtons.value[0]);
    watch(
      () => store.state.toolbarSetting.buttons,
      (newData) => {
        // このwatchはToolbar Setting更新時にも機能するが、
        // 以下の処理はVOICEVOX起動時のみ機能してほしいので、toolbarButtonsのlengthが0の時だけ機能させる
        if (!toolbarButtons.value.length) {
          toolbarButtons.value = [...newData];
          selectedButton.value = newData[0];
        }
      }
    );
    const usableButtonsDesc: Record<ToolbarButtonTagType, string> = {
      PLAY_CONTINUOUSLY:
        "選択されているテキスト以降のすべてのテキストを読み上げます。",
      STOP: "テキストが読み上げられているときに、それを止めます。",
      UNDO: "操作を一つ戻します。",
      REDO: "元に戻した操作をやり直します。",
      EMPTY:
        "これはボタンではありません。レイアウトの調整に使います。また、実際には表示されません。",
    };

    const headerBarCustomDialogOpenComputed = computed({
      get: () => props.modelValue || changedOrNotFlag.value,
      set: (val) => emit("update:modelValue", val),
    });
    watch(
      () => props.modelValue,
      (newValue) => {
        if (!newValue) {
          finishOrNotDialog();
        }
      }
    );

    const leftShiftable = computed(
      () => selectedButton.value !== toolbarButtons.value[0]
    );
    const rightShiftable = computed(
      () =>
        selectedButton.value !==
        toolbarButtons.value[toolbarButtons.value.length - 1]
    );

    const changedOrNotFlag = computed(() => {
      const nowSetting = store.state.toolbarSetting.buttons;
      return toolbarButtons.value.join("") !== nowSetting.join("");
    });

    const moveLeftButton = () => {
      const index = toolbarButtons.value.indexOf(selectedButton.value);
      toolbarButtons.value[index] = toolbarButtons.value[index - 1];
      toolbarButtons.value[index - 1] = selectedButton.value;
    };
    const moveRightButton = () => {
      const index = toolbarButtons.value.indexOf(selectedButton.value);
      toolbarButtons.value[index] = toolbarButtons.value[index + 1];
      toolbarButtons.value[index + 1] = selectedButton.value;
    };
    const removeButton = () => {
      const index = toolbarButtons.value.indexOf(selectedButton.value);
      toolbarButtons.value = [
        ...toolbarButtons.value.slice(0, index),
        ...toolbarButtons.value.slice(index + 1),
      ];
    };

    watch(
      () => toolbarButtons.value,
      (newData, oldData) => {
        if (oldData.length < newData.length) {
          selectedButton.value = newData[newData.length - 1];
        } else if (
          oldData.includes(selectedButton.value) &&
          !newData.includes(selectedButton.value)
        ) {
          selectedButton.value = newData[0];
        }
      }
    );

    const saveCustomToolbar = () => {
      store.dispatch("SET_TOOLBAR_SETTING", {
        data: {
          buttons: [...toolbarButtons.value],
        },
      });
    };

    const finishOrNotDialog = () => {
      // 配列の比較は出来ないので、文字列として結合したものを比較する
      if (changedOrNotFlag.value) {
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
        })
          .onOk(() => {
            toolbarButtons.value = [...store.state.toolbarSetting.buttons];
            selectedButton.value = toolbarButtons.value[0];
            headerBarCustomDialogOpenComputed.value = false;
          })
          .onCancel(() => {
            store.dispatch("IS_TOOLBAR_SETTING_DIALOG_OPEN", {
              isToolbarSettingDialogOpen: true,
            });
          });
      } else {
        headerBarCustomDialogOpenComputed.value = false;
      }
    };

    return {
      headerBarCustomDialogOpenComputed,
      toolbarButtons,
      selectedButton,
      leftShiftable,
      rightShiftable,
      changedOrNotFlag,
      moveLeftButton,
      moveRightButton,
      removeButton,
      saveCustomToolbar,
      usableButtonsDesc,
      getToolbarButtonName,
      finishOrNotDialog,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
.header-bar-custom-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  overflow-x: hidden;

  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.preview-toolbar {
  height: global.$header-height;
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
    100vh - #{global.$menubar-height + (global.$header-height * 2) +
      global.$window-border-width + 52px + 46px}
  );
  width: 100%;
  overflow-y: scroll;
}

.radio {
  padding: 6px 14px;
  border: solid 2px var(--color-background-light);
  border-radius: 3px;
  color: var(--color-display-dark);
  background-color: var(--color-background-light);
}

.radio:hover {
  @extend .radio-selected;
}

.radio-selected {
  @extend .radio;
  color: red;
  border: solid 2px red;
}

.radio-space {
  @extend .radio;
  flex-grow: 1;
  color: var(--color-background-light);
}

.radio-space:hover {
  @extend .radio-space-selected;
}

.radio-space-selected {
  @extend .radio-space;
  border: solid 2px red;
}
</style>
