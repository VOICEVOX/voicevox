<template>
  <q-badge
    v-if="$q.platform.is.mac"
    transparent
    color="transparent"
    text-color="display"
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
      color="display"
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <q-tooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </q-tooltip>
    </q-btn>
  </q-badge>
  <q-badge
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
      class="title-bar-buttons rotate-45"
      id="pinned-btn"
      @click="changePinWindow()"
    >
      <q-tooltip :delay="500" class="text-body2" :offset="[11, 11]">
        最前面に表示
      </q-tooltip>
    </q-btn>
  </q-badge>
  <min-max-close-buttons v-if="!$q.platform.is.mac" />
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import MinMaxCloseButtons from "@/components/MinMaxCloseButtons.vue";

export default defineComponent({
  name: "TitleBarButtons",
  components: { MinMaxCloseButtons },
  setup() {
    const store = useStore();

    const changePinWindow = () => {
      window.electron.changePinWindow();
    };

    const isPinned = computed(() => store.state.isPinned);

    return {
      changePinWindow,
      isPinned,
    };
  },
});
</script>

<style scoped lang="scss">
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
</style>
