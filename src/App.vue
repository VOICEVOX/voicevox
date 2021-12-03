<template>
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script lang="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent } from "vue";
import { useI18n } from "vue-i18n";
import { MessageSchema } from "./i18n";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary,
  },

  setup() {
    const store = useStore();
    store.dispatch("INIT_VUEX");
    store.dispatch("START_WAITING_ENGINE");

    const { locale, fallbackLocale } = useI18n<{ message: MessageSchema }>({
      useScope: "global",
    });

    store.watch(
      (state) => state.i18nSetting.lang,
      (value) => {
        locale.value = value as typeof locale.value;
      }
    );

    store.watch(
      (state) => state.i18nSetting.fallbackLang,
      (value) => {
        fallbackLocale.value = value as typeof fallbackLocale.value;
      }
    );
  },
});
</script>
