<template>
  <q-page class="relarive-absolute-wrapper scroller">
    <div class="q-pa-md markdown markdown-body" v-html="howToUse"></div>
  </q-page>
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

<style src="github-markdown-css/github-markdown.css"></style>

<style>
.markdown img {
  max-width: 50%;
}
</style>
