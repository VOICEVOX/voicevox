<template>
  <error-boundary>
    <router-view />
  </error-boundary>
</template>

<script type="ts">
import { useStore } from "@/store";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
import { defineComponent } from "vue";

export default defineComponent({
  name: "App",

  components: {
    ErrorBoundary
  },

  setup() {
    const store = useStore();

    store.dispatch("START_WAITING_ENGINE");
    store.dispatch("GET_USE_GPU");
    store.dispatch("GET_INHERIT_AUDIOINFO");
    store.dispatch("GET_SAVING_SETTING");
    store.dispatch("GET_HOTKEY_SETTINGS");
    store.dispatch("GET_USE_VOICING");
  }
});
</script>

<style lang="scss">
@use '@/styles' as global;

#app {
  display: flex;
  flex-direction: column;
}

img {
  pointer-events: none;
}

// ホバー色
.q-hoverable {
  &:hover > .q-focus-helper {
    background-color: global.$primary !important;
    opacity: 0.3 !important;
  }
  &.bg-primary:hover > .q-focus-helper {
    background-color: white !important;
    opacity: 0.2 !important;
  }
}

// リプル色
.q-ripple > .q-ripple__inner {
  background-color: global.$primary;
}
.bg-primary > .q-ripple > .q-ripple__inner {
  background-color: white;
}

.q-dialog,
#q-loading {
  .q-dialog__backdrop,
  .q-dialog__inner,
  .q-loading,
  .q-loading__backdrop {
    top: global.$menubar-height;
    left: global.$window-border-width;
    right: global.$window-border-width;
    bottom: global.$window-border-width;
  }
  .q-layout-container {
    box-shadow: none;
  }
}

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

// スクロールバーのデザイン
::-webkit-scrollbar {
  width: 15px;
  height: 15px;
  background-color: rgba(global.$primary, 0.2);
  border-radius: 5px;
}
::-webkit-scrollbar-thumb {
  background-color: rgba(global.$primary, 0.5);
  border-radius: 5px;
  &:hover {
    background-color: rgba(global.$primary, 0.6);
  }
  &:active {
    background-color: rgba(global.$primary, 0.8);
  }
}
</style>
