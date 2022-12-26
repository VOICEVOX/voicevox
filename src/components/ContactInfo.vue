<template>
  <QPage class="relative-absolute-wrapper scroller bg-background">
    <div class="q-pa-md markdown markdown-body" v-html="contact"></div>
  </QPage>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const store = useStore();
const contact = ref("");

const md = useMarkdownIt();

onMounted(async () => {
  contact.value = md.render(await store.dispatch("GET_CONTACT_TEXT"));
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
  border: 1px solid #333;
}
</style>
