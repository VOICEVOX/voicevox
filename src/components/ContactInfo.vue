<template>
  <q-page class="relative-absolute-wrapper scroller bg-background">
    <!-- eslint-disable-next-line vue/no-v-html -->
    <div class="q-pa-md markdown markdown-body" v-html="contact"></div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const store = useStore();
const contact = ref("");

const md = useMarkdownIt();

onMounted(async () => {
  contact.value = md
    .render(await store.dispatch("GET_CONTACT_TEXT"))
    .replace(
      "<!-- ログ表示ボタン説明挿入位置 -->",
      "</li><li>このページの右上の「ログフォルダを表示」ボタンを押すと、ログフォルダが表示されます。"
    );
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
