<template>
  <q-page class="relative-absolute-wrapper scroller bg-background">
    <div class="q-pa-md markdown markdown-body" v-html="qAndA"></div>
  </q-page>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

export default defineComponent({
  setup() {
    const store = useStore();
    const qAndA = ref("");

    const md = useMarkdownIt();

    onMounted(async () => {
      qAndA.value = md.render(await store.dispatch("GET_Q_AND_A_TEXT"));
    });

    return {
      qAndA,
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
