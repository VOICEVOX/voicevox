<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="header-bar-custom-dialog"
    v-model="headerBarCustomDialogOpenComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-white">
      <q-page-container class="root">
        <q-header class="q-py-sm">
          <q-toolbar>
            <q-toolbar-title class="text-secondary"
              >ツールバーのカスタマイズ</q-toolbar-title
            >
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="secondary"
              @click="headerBarCustomDialogOpenComputed = false"
            />
          </q-toolbar>
        </q-header>
        <q-page>
          <q-card flat class="preview-card">
            <q-card-actions>
              <div class="text-h5">カスタマイズのプレビュー</div>
              <q-space />
              <q-btn
                outline
                color="background-light"
                text-color="display-dark"
                class="text-no-wrap text-bold q-mr-sm"
                @click="saveCustomToolbar"
                >保存</q-btn
              >
            </q-card-actions>
            <q-toolbar class="bg-primary preview-toolbar">
              <template v-for="button in toolbarButtons" :key="button">
                <q-radio
                  v-if="button === '空白'"
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="button"
                  :class="
                    (selectedButton === button
                      ? 'radio-space-selected'
                      : 'radio-space') + ' q-mr-sm'
                  "
                />
                <q-radio
                  v-else
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="button"
                  :class="
                    (selectedButton === button ? 'radio-selected' : 'radio') +
                    ' text-no-wrap text-bold q-mr-sm'
                  "
                />
              </template>
            </q-toolbar>
            <q-card-actions>
              <div class="text-h5">「{{ selectedButton }}」を</div>
              <q-space />
              <q-btn
                outline
                color="background-light"
                text-color="display-dark"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="!leftShiftable"
                @click="moveLeftButton"
                >左に動かす</q-btn
              >
              <q-btn
                outline
                color="background-light"
                text-color="display-dark"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="!rightShiftable"
                @click="moveRightButton"
                >右に動かす</q-btn
              >
              <q-btn
                outline
                color="background-light"
                text-color="display-dark"
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
                  v-for="button in usableButtons"
                  :key="button.label"
                  tag="label"
                  v-ripple
                >
                  <q-item-section>
                    <q-item-label>{{ button.label }}</q-item-label>
                    <q-item-label caption>{{ button.desc }}</q-item-label>
                  </q-item-section>
                  <q-item-section avatar>
                    <q-toggle v-model="toolbarButtons" :val="button.label" />
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
    const usableButtons = [
      {
        label: "連続再生",
        desc: "選択されているテキスト以降のすべてのテキストを読み上げます。",
      },
      {
        label: "再生",
        desc: "選択されているテキストを読み上げます。",
      },
      {
        label: "停止",
        desc: "テキストが読み上げられているときに、それを止めます。",
      },
      {
        label: "音声書き出し",
        desc: "入力されているすべてのテキストの読み上げを音声ファイルに書き出します。",
      },
      {
        label: "一つだけ書き出し",
        desc: "選択されているテキストの読み上げを音声ファイルに書き出します。",
      },
      {
        label: "元に戻す",
        desc: "操作を一つ戻します。",
      },
      {
        label: "やり直す",
        desc: "元に戻した操作をやり直します。",
      },
      {
        label: "テキスト読み込み",
        desc: "テキストファイル(.txt)を読み込みます。",
      },
      {
        label: "空白",
        desc: "これはボタンではありません、ボタンを左右に配置したい際に使います。",
      },
    ];

    const headerBarCustomDialogOpenComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const leftShiftable = computed(
      () => selectedButton.value !== toolbarButtons.value[0]
    );
    const rightShiftable = computed(
      () =>
        selectedButton.value !==
        toolbarButtons.value[toolbarButtons.value.length - 1]
    );

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

    return {
      headerBarCustomDialogOpenComputed,
      toolbarButtons,
      selectedButton,
      usableButtons,
      leftShiftable,
      rightShiftable,
      moveLeftButton,
      moveRightButton,
      removeButton,
      saveCustomToolbar,
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
}

.usable-button-list {
  // menubar-height + header-height * 2(main+preview) + window-border-width
  // 52(preview part title & buttons) * 2 + 46(select part title)
  height: calc(
    100vh - #{global.$menubar-height + (global.$header-height * 2) +
      global.$window-border-width + (52px * 2) + 46px}
  );
  width: 100%;
  overflow-y: scroll;
}

.radio {
  padding: 8px 16px;
  border-radius: 3px;
  background-color: white;
}

.radio:hover {
  @extend .radio-selected;
}

.radio-selected {
  @extend .radio;
  background-color: #eeeeee;
}

.radio-space {
  @extend .radio;
  flex-grow: 1;
  color: global.$primary;
  background-color: global.$primary;
}

.radio-space:hover {
  @extend .radio-space-selected;
}

.radio-space-selected {
  @extend .radio-space;
  color: var(--color-setting-item);
  background-color: var(--color-setting-item);
}
</style>
