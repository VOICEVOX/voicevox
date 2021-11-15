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
              >ツールバーのカスタム</q-toolbar-title
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
            <q-card-actions class="bg-primary">
              <template v-for="button in toolbarButtons" :key="button">
                <q-space v-if="button === '空白'" />
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
                >左に動かす</q-btn
              >
              <q-btn
                outline
                color="background-light"
                text-color="display-dark"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="!rightShiftable"
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

<script>
import { computed, defineComponent, ref } from "vue";
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
    const toolbarButtons = computed(() => store.state.toolbarSetting.buttons);

    const headerBarCustomDialogOpenComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const selectedButton = ref(toolbarButtons.value[0]);
    const leftShiftable = computed(
      () => selectedButton.value !== toolbarButtons.value[0]
    );
    const rightShiftable = computed(
      () =>
        selectedButton.value !==
        toolbarButtons.value[toolbarButtons.value.length - 1]
    );

    return {
      headerBarCustomDialogOpenComputed,
      toolbarButtons,
      selectedButton,
      leftShiftable,
      rightShiftable,
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
}

.radio {
  padding: 8px 16px;
  margin: 5px;
  font-weight: bold;
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
</style>
