<template>
  <router-view />
</template>

<script type="ts">
import { useStore } from "@/store";
import { GET_USE_GPU } from "@/store/ui";
import { defineComponent } from "vue";

export default defineComponent({
  name: "App",

  setup() {
    const store = useStore();

    store.dispatch(GET_USE_GPU);
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
