<template>
  <q-badge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    text-color="secondary"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <q-btn
      v-if="isPinned"
      dense
      flat
      round
      icon="push_pin"
      color="teal"
      class="title-bar-buttons"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <q-tooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </q-tooltip>
    </q-btn>
    <q-btn
      v-else
      dense
      flat
      round
      icon="push_pin"
      color="black"
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <q-tooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </q-tooltip>
    </q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      color="green"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      round
      icon="lens"
      color="yellow"
      class="title-bar-buttons"
      @click="minimizeWindow()"
    ></q-btn>
    <q-btn
      dense
      flat
      icon="lens"
      color="red"
      class="title-bar-buttons"
      @click="closeWindow()"
    ></q-btn>
  </q-badge>
  <q-badge
    v-else
    transparent
    color="transparent"
    text-color="secondary"
    class="
      full-height
      cursor-not-allowed
      no-border-radius
      title-bar-buttons-root
    "
  >
    <q-btn
      v-if="isPinned"
      dense
      flat
      round
      icon="push_pin"
      color="teal"
      class="title-bar-buttons"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <q-tooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </q-tooltip>
    </q-btn>
    <q-btn
      v-else
      dense
      flat
      round
      icon="push_pin"
      color="black"
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <q-tooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </q-tooltip>
    </q-btn>
    <q-btn
      dense
      flat
      icon="minimize"
      class="title-bar-buttons"
      @click="minimizeWindow()"
    ></q-btn>

    <q-btn
      v-if="!isMaximized"
      dense
      flat
      icon="crop_square"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    ></q-btn>
    <q-btn
      v-else
      dense
      flat
      :icon="mdiWindowRestore"
      class="title-bar-buttons"
      @click="maximizeWindow()"
    >
    </q-btn>

    <q-btn
      dense
      flat
      icon="close"
      class="title-bar-buttons close"
      @click="closeWindow()"
    ></q-btn>
  </q-badge>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import Mousetrap from "mousetrap";
import { mdiWindowRestore } from "@quasar/extras/mdi-v5";

export default defineComponent({
  name: "TitleBarButtons",
  setup() {
    const store = useStore();

    const closeWindow = async () => {
      if (
        store.getters.IS_EDITED &&
        !(await window.electron.showConfirmDialog({
          title: "警告",
          message:
            "プロジェクトの変更が保存されていません。\n" +
            "変更を破棄してもよろしいですか？",
        }))
      ) {
        return;
      }
      window.electron.closeWindow();
    };
    const minimizeWindow = () => window.electron.minimizeWindow();
    const maximizeWindow = () => window.electron.maximizeWindow();
    const changePinWindow = () => {
      window.electron.changePinWindow();
    };

    const isPinned = computed(() => store.state.isPinned);

    const isMaximized = computed(() => store.state.isMaximized);

    Mousetrap.bind(["alt+f4", "command+q"], closeWindow);

    return {
      closeWindow,
      minimizeWindow,
      maximizeWindow,
      changePinWindow,
      mdiWindowRestore,
      isMaximized,
      isPinned,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles' as global;

.q-badge {
  padding: 0;
}

.title-bar-buttons-root {
  z-index: 2000;
}

.title-bar-buttons {
  -webkit-app-region: no-drag;
  overflow: visible;
}

.close:hover {
  background-color: red;
}
</style>
