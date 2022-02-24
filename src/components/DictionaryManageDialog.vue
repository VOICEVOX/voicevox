<template>
  <q-dialog
    maximized
    seamless
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog"
    v-model="dictionaryManageDialogOpenedComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container class="root">
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display">辞書管理</q-toolbar-title>
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="dictionaryManageDialogOpenedComputed = false"
            />
          </q-toolbar>
        </q-header>
        <q-page>
          <div />
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script>
import { computed, defineComponent } from "vue";

export default defineComponent({
  name: "DictionaryManageDialog",

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const dictionaryManageDialogOpenedComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    return {
      dictionaryManageDialogOpenedComputed,
    };
  },
});
</script>
