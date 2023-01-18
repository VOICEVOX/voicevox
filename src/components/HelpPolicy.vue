<template>
  <q-page class="relative-absolute-wrapper scroller bg-background">
    <div class="q-pa-md markdown markdown-body" v-html="policyHtml"></div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
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
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
