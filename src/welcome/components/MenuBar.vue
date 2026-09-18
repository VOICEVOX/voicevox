<template>
  <QBar class="bg-background q-pa-none relative-position">
    <div
      v-if="$q.platform.is.mac && !isFullscreen"
      class="mac-traffic-light-space"
    ></div>
    <img v-else src="/icon.png" class="window-logo" alt="application logo" />
    <QSpace />
    <div class="window-title">
      {{ titleText }}
    </div>
    <QSpace />
    <WindowControls v-if="!$q.platform.is.mac" :isMaximized :isFullscreen />
  </QBar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useQuasar } from "quasar";
import WindowControls from "./WindowControls.vue";
import { getAppInfos } from "@/domain/appInfo";

const $q = useQuasar();

/** 追加のバージョン情報。コミットハッシュなどを書ける。 */
const extraVersionInfo = import.meta.env.VITE_EXTRA_VERSION_INFO;

const titleText = computed(
  () =>
    "VOICEVOX" +
    (" - Ver. " + getAppInfos().version) +
    (extraVersionInfo ? ` (${extraVersionInfo})` : ""),
);

// FIXME: App.vue内に移動する
watch(
  titleText,
  (newTitle) => {
    window.document.title = newTitle;
  },
  {
    immediate: true,
  },
);

const isMaximized = ref(false);
const isFullscreen = ref(false);

const registerWindowListeners = () => {
  window.welcomeBackend.registerIpcHandler({
    detectMaximized: () => {
      isMaximized.value = true;
      isFullscreen.value = false;
    },
    detectUnmaximized: () => {
      isMaximized.value = false;
      isFullscreen.value = false;
    },
    detectEnterFullscreen: () => {
      isFullscreen.value = true;
    },
    detectLeaveFullscreen: () => {
      isFullscreen.value = false;
    },
  });
};

onMounted(async () => {
  try {
    isMaximized.value = await window.welcomeBackend.isMaximizedWindow();
  } catch (error) {
    window.welcomeBackend.logWarn("最大化状態の取得に失敗しました", error);
  }
  registerWindowListeners();
});
</script>

<style lang="scss">
@use "@/styles/colors" as colors;

.active-menu {
  background-color: rgba(colors.$primary-rgb, 0.3) !important;
}
</style>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.q-bar {
  height: vars.$menubar-height;
  -webkit-app-region: drag; // Electronのドラッグ領域
  :deep(.q-btn) {
    margin-left: 0;
    -webkit-app-region: no-drag; // Electronのドラッグ領域対象から外す
  }
}

.window-logo {
  height: vars.$menubar-height;
}

.window-title {
  height: vars.$menubar-height;
  text-overflow: ellipsis;
  overflow: hidden;
}

.mac-traffic-light-space {
  margin-right: 70px;
}
</style>
