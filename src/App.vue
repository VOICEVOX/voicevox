<template>
  <router-view />
</template>

<script type="ts">
import { defineComponent } from "vue";
import { useStore, LOAD_PROJECT_FILE } from "@/store";
import { USE_GPU } from "@/store/ui";

export default defineComponent({
  name: "App",

  setup() {
    const store = useStore();

    window.electron.useGPU().then(useGPU => {
      store.dispatch(USE_GPU, { useGPU });
    });
    window.electron.onReceivedIPCMsg("LOAD_PROJECT_FILE",
      (_, { filePath, confirm } = {}) => store.dispatch(LOAD_PROJECT_FILE, { filePath, confirm }));
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
