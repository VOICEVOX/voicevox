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
import MarkdownIt from "markdown-it";

export default defineComponent({
  setup() {
    const store = useStore();
    const policy = ref("");

    const md = new MarkdownIt();

    // 全てのリンクに_blankを付ける
    // https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md#renderer
    const defaultRender =
      md.renderer.rules.link_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      const aIdx = tokens[idx].attrIndex("target");

      if (aIdx < 0) {
        tokens[idx].attrPush(["target", "_blank"]);
      } else {
        const attrs = tokens[idx].attrs;
        if (attrs) attrs[aIdx][1] = "_blank";
        tokens[idx].attrs = attrs;
      }

      return defaultRender(tokens, idx, options, env, self);
    };

    onMounted(async () => {
      policy.value = md.render(await store.dispatch(GET_POLICY_TEXT));
    });

    return {
      policy,
    };
  },
});
</script>

<style lang="scss">
.markdown {
  // h1-h6のスタイルをデフォルトに戻す
  // https://www.w3schools.com/tags/tag_hn.asp
  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    display: block;
    margin-left: 0;
    margin-right: 0;
    font-weight: bold;
  }
  h1 {
    font-size: 2rem;
    margin-top: 0.67rem;
    margin-bottom: 0.67rem;
  }
  h2 {
    font-size: 1.5rem;
    margin-top: 0.83rem;
    margin-bottom: 0.83rem;
  }
  h3 {
    font-size: 1.17rem;
    margin-top: 1rem;
    margin-bottom: 1rem;
  }
  h4 {
    font-size: 1rem;
    margin-top: 1.33rem;
    margin-bottom: 1.33rem;
  }
  h5 {
    font-size: 0.83rem;
    margin-top: 1.67rem;
    margin-bottom: 1.67rem;
  }
  h6 {
    font-size: 0.67rem;
    margin-top: 2.33rem;
    margin-bottom: 2.33rem;
  }
}
</style>

<style scoped lang="scss">
.root {
  .scroller {
    width: 100%;
    overflow: auto;
  }
}
</style>
