<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const store = useStore();
const qAndA = ref("");

const md = useMarkdownIt();

onMounted(async () => {
  qAndA.value = md.render(await store.dispatch("GET_Q_AND_A_TEXT"));
});
</script>

<template>
  <QPage class="relative-absolute-wrapper scroller bg-background">
    <div class="q-pa-md markdown markdown-body" v-html="qAndA"></div>
  </QPage>
</template>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
