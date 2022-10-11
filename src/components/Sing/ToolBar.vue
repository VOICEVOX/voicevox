<template>
  <div class="sing-toolbar">
    <div
      class="singer-panel-toggler"
      v-bind:class="{ active: isShowSinger }"
      @click="toggleShowSinger"
    >
      <div class="singer-avatar" />
      {showSinger}
      <!-- <img src="" class="singer-avatar" /> -->
    </div>
    <div class="sing-player">
      <button type="button">戻る</button>
      <button type="button">再生</button>
      <div class="sing-player-position">00:00</div>
      <input type="number" value="120" />
      <input type="number" value="4" />/
      <input type="number" value="4" />
    </div>
    <div class="sing-setting">
      <input type="range" min="0" max="100" class="sing-volume" />
      <select>
        <option>1/16</option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, ComputedRef } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
import { HotkeyAction, HotkeyReturnType } from "@/type/preload";
import { setHotkeyFunctions } from "@/store/setting";

export default defineComponent({
  name: "SingToolBar",

  setup() {
    const store = useStore();
    const $q = useQuasar();
    const isShowSinger = computed(() => store.state.isShowSinger);
    const toggleShowSinger = () => {
      store.dispatch("SET_SHOW_SINGER", {
        isShowSinger: !isShowSinger.value,
      });
    };
    return {
      isShowSinger,
      toggleShowSinger,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.sing-toolbar {
  border-top: 1px solid #ccc;
  border-bottom: 1px solid #ccc;
  align-items: center;
  display: flex;
  padding: 8px 16px;
  width: 100%;
}
.singer-panel-toggler {
  border: 2px solid #777;
  border-radius: 50%;
  display: block;
  height: 48px;
  margin-right: auto;
  overflow: hidden;
  width: 48px;

  &:hover {
    cursor: pointer;
  }

  &.active {
    border-color: red;
  }
}

.singer-avatar {
  background: #777;
  display: block;
  object-fit: cover;
  height: 100%;
  width: 100%;
}

.sing-player {
  align-items: center;
  display: flex;
}

.sing-setting {
  align-items: center;
  display: flex;
  margin-left: auto;
}

.sing-volume {
  margin-right: 4px;
  width: 72px;
}
</style>
