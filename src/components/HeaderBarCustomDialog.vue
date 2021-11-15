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
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
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
            <q-card-actions class="bg-primary">
              <template v-for="button in toolbarButtons" :key="button">
                <q-radio
                  v-if="button === '空白'"
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="button"
                  :class="
                    selectedButton === button
                      ? 'radio-space-selected'
                      : 'radio-space'
                  "
                />
                <q-radio
                  v-else
                  v-model="selectedButton"
                  size="0"
                  :val="button"
                  :label="button"
                  :class="
                    selectedButton === button ? 'radio-selected' : 'radio'
                  "
                />
              </template>
            </q-card-actions>
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
                >削除する</q-btn
              >
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
        toolbarButtons.value = [...newData];
        selectedButton.value = newData[0];
      }
    );

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
      leftShiftable,
      rightShiftable,
      moveLeftButton,
      moveRightButton,
      saveCustomToolbar,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;
.header-bar-custom-dialog .q-layout-container :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.preview-card {
  width: 100%;
  min-width: 460px;
  background: var(--color-background);
}

.radio {
  padding: 8px 16px;
  margin: 5px;
  font-weight: bold;
  border-radius: 3px;
  background-color: var(--color-background);
}

.radio:hover {
  @extend .radio-selected;
}

.radio-selected {
  @extend .radio;
  background-color: var(--color-setting-item);
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
