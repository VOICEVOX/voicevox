<template>
  <QPage class="relative-absolute-wrapper scroller markdown-body">
    <div class="q-pa-md markdown" v-html="howToUse"></div>
  </QPage>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const store = useStore();
const howToUse = ref("");
const md = useMarkdownIt();
onMounted(async () => {
  howToUse.value = md.render(await store.dispatch("GET_HOW_TO_USE_TEXT"));
});
</script>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}

.markdown :deep(img) {
  border: 1px solid #888;
  vertical-align: middle;
  margin-bottom: 1rem;
}
</style>
