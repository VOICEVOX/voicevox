<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary">使い方</q-toolbar-title>
      </q-toolbar>
    </q-header>
    <q-page class="relarive-absolute-wrapper scroller">
      <div class="q-pa-md markdown" v-html="howToUse"></div>
    </q-page>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
export default defineComponent({
  setup() {
    const store = useStore();
    const howToUse = ref("");
    const md = useMarkdownIt();
    onMounted(async () => {
      howToUse.value = md.render(await store.dispatch("GET_HOW_TO_USE_TEXT"));
    });
    return {
      howToUse,
    };
  },
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
