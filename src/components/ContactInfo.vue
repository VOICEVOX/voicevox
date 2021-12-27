<template>
  <q-page class="relative-absolute-wrapper scroller markdown-body">
    <div class="q-pa-md markdown" v-html="Contact"></div>
  </q-page>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";
export default defineComponent({
  setup() {
    const store = useStore();
    const ContactInfo = ref("");
    const md = useMarkdownIt();
    onMounted(async () => {
      ContactInfo.value = md.render(await store.dispatch("GET_CONTACT_TEXT"));
    });
    return {
      ContactInfo,
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

.markdown :deep(img) {
  border: 1px solid #333;
}
</style>
