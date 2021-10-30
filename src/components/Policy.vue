<template>
  <q-page class="relative-absolute-wrapper scroller">
    <div class="q-pa-md markdown" v-html="policy"></div>
  </q-page>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

export default defineComponent({
  setup() {
    const store = useStore();
    const policy = ref("");

    const md = useMarkdownIt();

    onMounted(async () => {
      policy.value = md.render(await store.dispatch("GET_POLICY_TEXT"));
    });

    return {
      policy,
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
