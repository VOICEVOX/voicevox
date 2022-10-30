<template>
  <div class="sing-singer-panel" v-bind:class="{ hide: !isShowSinger }">
    <character-menu-button
      class="character-menu-button"
      :engineId="engineId"
      :styleId="styleId"
      touchPosition
      :disable="uiLocked"
      @ChangeStyleId="changeStyleId"
    >
      <span class="character-name">{{ characterName }}</span>
      <div class="character-portrait-wrapper">
        <img class="character-portrait" :src="portraitPath" />
      </div>
    </character-menu-button>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from "vue";
import { useStore } from "@/store";
import CharacterMenuButton from "@/components/Sing/CharacterMenuButton.vue";

export default defineComponent({
  name: "SingSingerPanel",
  components: {
    CharacterMenuButton,
  },

  setup() {
    const store = useStore();
    const isShowSinger = computed(() => store.state.isShowSinger);

    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const userOrderedCharacterInfos = computed(
      () => store.getters.USER_ORDERED_CHARACTER_INFOS
    );

    const engineId = computed(() => store.state.engineId);
    const styleId = computed(() => store.state.styleId);

    const changeStyleId = (engineId: string, styleId: number) => {
      store.dispatch("SET_SINGER", { engineId, styleId });
    };

    const characterInfo = computed(() => {
      const engineId = store.state.engineId;
      const styleId = store.state.styleId;
      if (userOrderedCharacterInfos.value === undefined) return undefined;
      if (engineId === undefined || styleId === undefined) return undefined;
      return store.getters.CHARACTER_INFO(engineId, styleId);
    });

    const characterName = computed(() => {
      const styleId = store.state.styleId;
      const style = characterInfo.value?.metas.styles.find(
        (style) => style.styleId === styleId
      );
      return style?.styleName
        ? `${characterInfo.value?.metas.speakerName} (${style?.styleName})`
        : characterInfo.value?.metas.speakerName;
    });

    const portraitPath = computed(() => characterInfo.value?.portraitPath);

    return {
      isShowSinger,
      uiLocked,
      userOrderedCharacterInfos,
      engineId,
      styleId,
      changeStyleId,
      characterInfo,
      characterName,
      portraitPath,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.character-name {
  position: absolute;
  top: 0px;
  left: 0px;
  padding: 1px 24px 1px 8px;
  background-image: linear-gradient(
    90deg,
    rgba(colors.$background-rgb, 0.5) 0%,
    rgba(colors.$background-rgb, 0.5) 75%,
    transparent 100%
  );
  overflow-wrap: anywhere;
}

.sing-singer-panel {
  background: colors.$background;
  border-right: 1px solid #ccc;
  height: 100%;
  width: 200px;

  &.hide {
    display: none;
  }
}

.character-portrait-wrapper {
  display: grid;
  justify-content: center;

  .character-portrait {
    margin-left: auto;
    margin-right: auto;
  }
}

.character-menu-button {
  height: 168px;
  width: 100%;
  border-bottom: 1px solid #ccc;
  box-shadow: 0px -2px 4px -3px #ccc inset;
  overflow: hidden;
  border-radius: 0px;
}
</style>
