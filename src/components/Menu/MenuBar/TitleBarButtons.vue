<template>
  <QBadge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    textColor="display"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <QBtn
      v-if="isPinned"
      id="pinned-btn"
      dense
      flat
      round
      icon="push_pin"
      color="teal"
      class="title-bar-buttons"
      aria-label="最前面固定を解除"
      @click="changePinWindow()"
    >
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面固定を解除
      </QTooltip>
    </QBtn>
    <QBtn
      v-else
      id="pinned-btn"
      dense
      flat
      round
      icon="push_pin"
      color="display"
      class="title-bar-buttons rotate-45"
      aria-label="最前面に固定"
      @click="changePinWindow()"
    >
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に固定
      </QTooltip>
    </QBtn>
  </QBadge>
  <QBadge
    v-else
    transparent
    color="transparent"
    textColor="display"
    class="full-height cursor-not-allowed no-border-radius title-bar-buttons-root"
  >
    <QBtn
      v-if="isPinned"
      id="pinned-btn"
      dense
      flat
      round
      icon="push_pin"
      color="teal"
      class="title-bar-buttons"
      aria-label="最前面固定を解除"
      @click="changePinWindow()"
    >
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面固定を解除
      </QTooltip>
    </QBtn>
    <QBtn
      v-else
      id="pinned-btn"
      dense
      flat
      round
      icon="push_pin"
      class="title-bar-buttons rotate-45"
      aria-label="最前面に固定"
      @click="changePinWindow()"
    >
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に固定
      </QTooltip>
    </QBtn>
  </QBadge>
  <MinMaxCloseButtons v-if="!$q.platform.is.mac" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import MinMaxCloseButtons from "./MinMaxCloseButtons.vue";
import { useStore } from "@/store";

const store = useStore();

const changePinWindow = () => {
  window.backend.changePinWindow();
};

const isPinned = computed(() => store.state.isPinned);
</script>

<style scoped lang="scss">
.q-badge {
  padding: 0;
  margin-left: 0;
}

.title-bar-buttons-root {
  z-index: 2000;
}

.title-bar-buttons {
  overflow: visible;
}
</style>
