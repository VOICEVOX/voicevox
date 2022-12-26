<template>
  <QBadge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    text-color="display"
    class="full-height cursor-not-allowed no-border-radius"
  >
    <QBtn
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
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </QTooltip>
    </QBtn>
    <QBtn
      v-else
      dense
      flat
      round
      icon="push_pin"
      color="display"
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </QTooltip>
    </QBtn>
  </QBadge>
  <QBadge
    v-else
    transparent
    color="transparent"
    text-color="display"
    class="
      full-height
      cursor-not-allowed
      no-border-radius
      title-bar-buttons-root
    "
  >
    <QBtn
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
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </QTooltip>
    </QBtn>
    <QBtn
      v-else
      dense
      flat
      round
      icon="push_pin"
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <QTooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </QTooltip>
    </QBtn>
  </QBadge>
  <MinMaxCloseButtons v-if="!$q.platform.is.mac" />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "@/store";
import MinMaxCloseButtons from "@/components/MinMaxCloseButtons.vue";

const store = useStore();

const changePinWindow = () => {
  window.electron.changePinWindow();
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
  -webkit-app-region: no-drag;
  overflow: visible;
}
</style>
