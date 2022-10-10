<template>
  <div class="sing-toolbar">
    <div class="singer-panel-toggler">
      <div class="singer-avatar" />
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
    return null;
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
  border-radius: 50%;
  display: block;
  height: 48px;
  margin-right: auto;
  overflow: hidden;
  width: 48px;

  &:hover {
    cursor: pointer;
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
