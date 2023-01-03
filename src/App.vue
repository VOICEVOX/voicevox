<template>
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script lang="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent, watch, computed } from "vue";
import { useGtm } from "@gtm-support/vue-gtm";
import { useRoute } from "vue-router";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },

  setup() {
    const store = useStore();
    store.dispatch("INIT_VUEX");

    // URLパラメータに従ってセーフモードにする
    const route = useRoute();
    const query = computed(() => route.query);
    watch(query, (newQuery) => {
      if (newQuery) {
        store.dispatch("SET_IS_SAFE_MODE", newQuery["isSafeMode"] === "true");
      }
    });

    // Google Tag Manager
    const gtm = useGtm();
    watch(
      () => store.state.acceptRetrieveTelemetry,
      (acceptRetrieveTelemetry) => {
        gtm?.enable(acceptRetrieveTelemetry === "Accepted");
      },
      { immediate: true }
    );

    // フォントの制御用パラメータを変更する
    watch(
      () => store.state.editorFont,
      (editorFont) => {
        document.body.setAttribute("data-editor-font", editorFont);
      },
      { immediate: true }
    );
  },
});
</script>
