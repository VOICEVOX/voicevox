<template>
  <q-page class="relative-absolute-wrapper scroller bg-background">
    <div class="q-pa-md markdown markdown-body" v-html="policyHtml"></div>
  </q-page>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from "vue";
import { useStore } from "@/store";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

export default defineComponent({
  props: {
    policy: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    const policyHtml = ref("");

    const md = useMarkdownIt();

    onMounted(async () => {
      policyHtml.value = md.render(props.policy);
    });

    return {
      policyHtml,
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
