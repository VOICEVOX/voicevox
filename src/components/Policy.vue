<template>
  <div class="root">
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-toolbar-title class="text-secondary"
          >ソフトウェアの利用規約</q-toolbar-title
        >
      </q-toolbar>
    </q-header>
    <q-page class="relarive-absolute-wrapper scroller">
      <div class="q-pa-md markdown" v-html="policy"></div>
    </q-page>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore, GET_POLICY_TEXT } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

export default defineComponent({
  setup() {
    const store = useStore();
    const policy = ref("");

    const md = useMarkdownIt();

    onMounted(async () => {
      policy.value = md.render(
        await store.dispatch(GET_POLICY_TEXT, undefined)
      );
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
