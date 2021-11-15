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
              >ツールバーのカスタム</q-toolbar-title
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
          <q-card class="preview-card">
            <q-card-actions class="bg-primary">
              <header-bar />
            </q-card-actions>
          </q-card>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script>
import { computed, defineComponent } from "vue";
import HeaderBar from "@/components/HeaderBar";

export default defineComponent({
  name: "HeaderBarCustomDialog",
  components: { HeaderBar },
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const headerBarCustomDialogOpenComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    return {
      headerBarCustomDialogOpenComputed,
    };
  },
});
</script>

<style lang="scss" scoped>
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
  background: var(--color-background);
}
</style>
