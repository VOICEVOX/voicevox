<template>
  <q-btn
    ref="buttonRef"
    flat
    class="q-pa-none character-button"
    :disable="uiLocked"
    :class="{ opaque: loading }"
    aria-haspopup="menu"
  >
    <!-- q-imgだとdisableのタイミングで点滅する -->
    <div class="icon-container">
      <img
        v-if="selectedStyleInfo != undefined"
        class="q-pa-none q-ma-none"
        :src="selectedStyleInfo.iconPath"
        :alt="selectedVoiceInfoText"
      />
      <q-avatar v-else-if="!emptiable" rounded size="2rem" color="primary"
        ><span color="text-display-on-primary">?</span></q-avatar
      >
    </div>
    <div v-if="loading" class="loading">
      <q-spinner color="primary" size="1.6rem" :thickness="7" />
    </div>
    <character-tree :items="characterTreeItems" is-root />
  </q-btn>
</template>

<script setup lang="ts">
import { QBtn } from "quasar";
import { computed } from "vue";
import CharacterTree, { ButtonData } from "./CharacterTree.vue";
import { CharacterInfo, EngineId, SpeakerId, Voice } from "@/type/preload";
import { formatCharacterStyleName } from "@/store/utility";

const props = withDefaults(
  defineProps<{
    characterInfos: CharacterInfo[];
    loading?: boolean;
    selectedVoice: Voice | undefined;
    showEngineInfo?: boolean;
    emptiable?: boolean;
    uiLocked: boolean;
    engineIcons: Record<EngineId, string>;
    defaultStyleIds: Record<
      SpeakerId,
      {
        engineId: EngineId;
        styleId: number;
      }
    >;
  }>(),
  {
    loading: false,
    showEngineInfo: false,
    emptiable: false,
  }
);

const emit = defineEmits({
  "update:selectedVoice": (selectedVoice: Voice | undefined) => {
    return (
      selectedVoice == undefined ||
      (typeof selectedVoice.engineId === "string" &&
        typeof selectedVoice.speakerId === "string" &&
        typeof selectedVoice.styleId === "number")
    );
  },
});

const selectedCharacter = computed(() => {
  const selectedVoice = props.selectedVoice;
  if (selectedVoice == undefined) return undefined;
  const character = props.characterInfos.find(
    (characterInfo) =>
      characterInfo.metas.speakerUuid === selectedVoice?.speakerId &&
      characterInfo.metas.styles.some(
        (style) =>
          style.engineId === selectedVoice.engineId &&
          style.styleId === selectedVoice.styleId
      )
  );
  return character;
});

const selectedVoiceInfoText = computed(() => {
  if (!selectedCharacter.value) {
    return "キャラクター未選択";
  }

  const speakerName = selectedCharacter.value.metas.speakerName;
  if (!selectedStyleInfo.value) {
    return speakerName;
  }

  const styleName = selectedStyleInfo.value.styleName;
  return formatCharacterStyleName(speakerName, styleName);
});

const isSelectedItem = (characterInfo: CharacterInfo) =>
  selectedCharacter.value != undefined &&
  characterInfo.metas.speakerUuid ===
    selectedCharacter.value?.metas.speakerUuid;

const selectedStyleInfo = computed(() => {
  const selectedVoice = props.selectedVoice;
  const style = selectedCharacter.value?.metas.styles.find(
    (style) =>
      style.engineId === selectedVoice?.engineId &&
      style.styleId === selectedVoice.styleId
  );
  return style;
});

const getDefaultStyle = (speakerUuid: SpeakerId) => {
  // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
  const characterInfo = props.characterInfos.find(
    (info) => info.metas.speakerUuid === speakerUuid
  );
  const defaultStyleId = props.defaultStyleIds[speakerUuid];

  const defaultStyle =
    characterInfo?.metas.styles.find(
      (style) =>
        style.engineId === defaultStyleId.engineId &&
        style.styleId === defaultStyleId.styleId
    ) ?? characterInfo?.metas.styles[0]; // デフォルトのスタイルIDが見つからない場合stylesの先頭を選択する

  if (defaultStyle == undefined) throw new Error("defaultStyle == undefined");

  return defaultStyle;
};

const characterTreeItems = computed<ButtonData[]>(() =>
  props.characterInfos.map((characterInfo) => {
    const styles: ButtonData[] = characterInfo.metas.styles.map((style) => ({
      id: `${style.engineId}-${style.styleId}`,
      label: formatCharacterStyleName(
        characterInfo.metas.speakerName,
        style.styleName
      ),
      icon: style.iconPath,
      subIcon: props.engineIcons[style.engineId],
      treeAlt: `${characterInfo.metas.speakerName}の${style.styleName}スタイル`,
      selected:
        selectedCharacter.value != undefined &&
        selectedCharacter.value.metas.speakerUuid ===
          characterInfo.metas.speakerUuid &&
        selectedStyleInfo.value != undefined &&
        selectedStyleInfo.value.engineId === style.engineId &&
        selectedStyleInfo.value.styleId === style.styleId,
    }));

    return {
      id: characterInfo.metas.speakerUuid,
      label: characterInfo.metas.speakerName,
      icon:
        characterInfo.metas.styles.find(
          (style) =>
            style.styleId ===
            props.defaultStyleIds[characterInfo.metas.speakerUuid].styleId
        )?.iconPath || "",
      subIcon:
        props.engineIcons[
          getDefaultStyle(characterInfo.metas.speakerUuid).engineId
        ],
      treeAlt: `${characterInfo.metas.speakerName}のスタイル、マウスオーバーするか、右矢印キーを押してスタイル選択を表示できます`,
      selected: isSelectedItem(characterInfo),
      items: styles.length > 1 ? styles : [],
    };
  })
);
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.character-button {
  border: solid 1px;
  border-color: colors.$primary;
  font-size: 0;
  height: fit-content;

  background: colors.$background;

  .icon-container {
    height: 2rem;
    width: 2rem;

    img {
      max-height: 100%;
      max-width: 100%;
      object-fit: scale-down;
    }
  }

  .loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    margin: auto;
    background-color: rgba(colors.$background-rgb, 0.74);
    display: grid;
    justify-content: center;
    align-content: center;

    svg {
      filter: drop-shadow(0 0 1px colors.$background);
    }
  }
}

.opaque {
  opacity: 1 !important;
}

.character-menu {
  .character-item-container {
    display: flex;
    flex-direction: column;
  }

  .q-item {
    color: colors.$display;
  }

  .q-btn-group {
    > .q-btn:first-child > :deep(.q-btn__content) {
      justify-content: flex-start;
    }

    > div:last-child:hover {
      background-color: rgba(colors.$primary-rgb, 0.1);
    }
  }

  .warning-item {
    order: -3;
  }
  .to-unselect-item {
    order: -2;
  }
  .selected-character-item {
    order: -1; // 選択中のキャラを上にする
  }

  .selected-character-item,
  .selected-style-item,
  .selected-background {
    background-color: rgba(colors.$primary-rgb, 0.2);
  }

  .engine-icon {
    position: absolute;
    width: 13px;
    height: 13px;
    bottom: -6px;
    right: -6px;
  }
}
</style>
