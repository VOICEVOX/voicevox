<template>
  <div class="container">
    <BaseScrollArea>
      <div class="inner">
        <BaseDocumentView>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="documentHtml"></div>
        </BaseDocumentView>
      </div>
    </BaseScrollArea>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import BaseDocumentView from "@/components/Base/BaseDocumentView.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const props = defineProps<{
  markdown: string;
}>();

const md = useMarkdownIt();

const documentHtml = computed(() => {
  return md.render(props.markdown);
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;

.container {
  height: 100%;
}

.inner {
  padding: vars.$padding-2;
  max-width: 960px;
  margin: auto;
}
</style>
