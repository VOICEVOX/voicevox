<template>
  <router-view />
</template>

<script type="ts">
import { computed, defineComponent, watch } from "vue";
import { useStore, SAVE_PROJECT_FILE, LOAD_PROJECT_FILE } from "@/store";
import { UI_LOCKED, UPDATE_MENU } from "@/store/ui";
import {
  GENERATE_AND_SAVE_ALL_AUDIO,
  IMPORT_FROM_FILE,
} from "@/store/audio";
import {
  GENERATE_AND_SAVE_ALL_AUDIO as IPC_GENERATE_AND_SAVE_ALL_AUDIO,
  IMPORT_FROM_FILE as IPC_IMPORT_FROM_FILE,
  SAVE_PROJECT_FILE as IPC_SAVE_PROJECT_FILE,
  LOAD_PROJECT_FILE as IPC_LOAD_PROJECT_FILE,
} from "@/electron/ipc";

export default defineComponent({
  name: "App",
  setup() {
    const store = useStore();
    const uiLocked = computed(() => store.getters[UI_LOCKED]);

    const updateMenu = () => {
      store.dispatch(UPDATE_MENU, {
        uiLocked: uiLocked.value,
      });
    };
    watch(uiLocked, updateMenu);
    updateMenu();

    window.electron.onReceivedIPCMsg(IPC_GENERATE_AND_SAVE_ALL_AUDIO, () => store.dispatch(GENERATE_AND_SAVE_ALL_AUDIO, {}));
    window.electron.onReceivedIPCMsg(IPC_IMPORT_FROM_FILE, () => store.dispatch(IMPORT_FROM_FILE, {}));
    window.electron.onReceivedIPCMsg(IPC_SAVE_PROJECT_FILE, () => store.dispatch(SAVE_PROJECT_FILE, {}));
    window.electron.onReceivedIPCMsg(IPC_LOAD_PROJECT_FILE, () => store.dispatch(LOAD_PROJECT_FILE, {}));
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
