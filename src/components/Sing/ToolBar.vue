<template>
  <div class="sing-toolbar">
    <div
      class="singer-panel-toggler"
      v-bind:class="{ active: isShowSinger }"
      @click="toggleShowSinger"
    >
      <img :src="selectedStyleIconPath" class="singer-avatar" />
    </div>
    <div class="sing-player">
      <button type="button" class="sing-button-temp">戻る</button>
      <button type="button" class="sing-button-temp">再生</button>
      <div class="sing-player-position">00:00</div>
      <input type="number" value="120" class="sing-bpm" />
      <input type="number" value="4" class="sing-tempo" />/
      <input type="number" value="4" class="sing-tempo" />
    </div>
    <div class="sing-setting">
      <input type="range" min="0" max="100" class="sing-volume" />
      <select class="sing-snap">
        <option>1/16</option>
      </select>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";

export default defineComponent({
  name: "SingToolBar",

  setup() {
    const store = useStore();
    const isShowSinger = computed(() => store.state.isShowSinger);
    const toggleShowSinger = () => {
      store.dispatch("SET_SHOW_SINGER", {
        isShowSinger: !isShowSinger.value,
      });
    };

    const userOrderedCharacterInfos = computed(
      () => store.getters.USER_ORDERED_CHARACTER_INFOS
    );
    const selectedCharacterInfo = computed(() =>
      userOrderedCharacterInfos.value !== undefined &&
      store.state.engineId !== undefined &&
      store.state.styleId !== undefined
        ? store.getters.CHARACTER_INFO(
            store.state.engineId,
            store.state.styleId
          )
        : undefined
    );
    const selectedStyleIconPath = computed(
      () =>
        selectedCharacterInfo.value?.metas.styles.find(
          (style) =>
            style.styleId === store.state.styleId &&
            style.engineId === store.state.engineId
        )?.iconPath
    );

    return {
      isShowSinger,
      toggleShowSinger,
      userOrderedCharacterInfos,
      selectedCharacterInfo,
      selectedStyleIconPath,
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
    border-color: colors.$primary;
  }
}

.singer-avatar {
  background: colors.$background;
  display: block;
  object-fit: cover;
  height: 100%;
  width: 100%;
}

.sing-player {
  align-items: center;
  display: flex;
}

.sing-button-temp {
  margin: 0 4px;
}

.sing-bpm {
  margin: 0 4px;
  width: 56px;
}

.sing-tempo {
  margin: 0 4px;
  width: 32px;
}

.sing-player-position {
  font-size: 18px;
  margin: 0 4px;
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
