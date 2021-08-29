<template>
  <router-view />
</template>

<script type="ts">
import { useStore } from "@/store";
import { GET_USE_GPU, GET_FILE_ENCODING } from "@/store/ui";
import { defineComponent } from "vue";
import { GET_HOTKEY_SETTING, GET_WHEEL_SETTING } from "./store/setting";

export default defineComponent({
  name: "App",

  setup() {
    const store = useStore();

    store.dispatch(GET_USE_GPU);
    store.dispatch(GET_FILE_ENCODING);
    store.dispatch(GET_HOTKEY_SETTING)
    store.dispatch(GET_WHEEL_SETTING);
  }
});
</script>

<style lang="scss">
@use '@/styles' as global;

#app {
  display: flex;
  flex-direction: column;
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
