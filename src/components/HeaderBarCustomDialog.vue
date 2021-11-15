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
                <q-space v-if="button === ''" />
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

    return {
      headerBarCustomDialogOpenComputed,
      toolbarButtons,
      selectedButton,
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
  min-width: 400px;
}

.radio {
  padding: 8px 16px;
  margin: 5px;
  font-weight: bold;
  border-radius: 3px;
  background-color: var(--color-background);
}
.radio-selected {
  @extend .radio;
  background-color: var(--color-setting-item);
}
</style>
