<template>
  <q-page class="relative-absolute-wrapper scroller markdown-body">
    <div class="q-pa-md markdown" v-html="ossCommunityInfos"></div>
  </q-page>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
export default defineComponent({
  setup() {
    const store = useStore();
    const ossCommunityInfos = ref("");
    const md = useMarkdownIt();
    onMounted(async () => {
      ossCommunityInfos.value = md.render(
        await store.dispatch("GET_OSS_COMMUNITY_INFOS")
      );
    });
    return {
      ossCommunityInfos,
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
