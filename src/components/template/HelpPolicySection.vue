<template>
  <div class="container">
    <BaseScrollArea>
      <div class="inner">
        <BaseDocumentView>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div v-html="policyHtml"></div>
        </BaseDocumentView>
      </div>
    </BaseScrollArea>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import BaseDocumentView from "../base/BaseDocumentView.vue";
import BaseScrollArea from "../base/BaseScrollArea.vue";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

const props =
  defineProps<{
    policy: string;
  }>();

const policyHtml = ref("");

const md = useMarkdownIt();

onMounted(async () => {
  policyHtml.value = md.render(props.policy);
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/new-colors' as colors;

.container {
  // TODO: 親コンポーネントからheightを取得できないため一時的にcalcを使用、HelpDialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
  background-color: colors.$surface;
}

.inner {
  padding: vars.$padding-2;
}
</style>
