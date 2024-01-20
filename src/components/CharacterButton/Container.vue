<template>
  <presentation
    :loading
    :character-infos="props.characterInfos"
    :selected-voice="props.selectedVoice"
    :show-engine-info="props.showEngineInfo"
    :emptiable
    :ui-locked="props.uiLocked"
    :engine-icons="engineIcons"
    :default-style-ids="defaultStyleIds"
    :max-height="maxMenuHeight"
    @before-show="updateMenuHeight"
  />
</template>
<script lang="ts">
export default {
  name: "CharacterButton",
};
</script>

<script setup lang="ts">
import { Ref, computed, ref } from "vue";
import Presentation from "./Presentation.vue";
import { base64ImageToUri } from "@/helpers/imageHelper";
import { useStore } from "@/store";
import { CharacterInfo, Voice } from "@/type/preload";
import { QBtn } from "quasar";

const props = withDefaults(
  defineProps<{
    characterInfos: CharacterInfo[];
    loading?: boolean;
    selectedVoice: Voice | undefined;
    showEngineInfo?: boolean;
    emptiable?: boolean;
    uiLocked: boolean;
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

const store = useStore();

const defaultStyleIds = computed(() =>
  Object.fromEntries(
    store.state.defaultStyleIds.map((defaultStyleId) => [
      defaultStyleId.speakerUuid,
      {
        engineId: defaultStyleId.engineId,
        styleId: defaultStyleId.defaultStyleId,
      },
    ])
  )
);

const engineIcons = computed(() =>
  Object.fromEntries(
    store.state.engineIds.map((engineId) => [
      engineId,
      base64ImageToUri(store.state.engineManifests[engineId].icon),
    ])
  )
);

// 高さを制限してメニューが下方向に展開されるようにする
const buttonRef: Ref<InstanceType<typeof QBtn> | undefined> = ref();
const heightLimit = "65vh"; // QMenuのデフォルト値
const maxMenuHeight = ref(heightLimit);
const updateMenuHeight = () => {
  if (buttonRef.value == undefined)
    throw new Error("buttonRef.value == undefined");
  const el = buttonRef.value.$el;
  if (!(el instanceof Element)) throw new Error("!(el instanceof Element)");
  const buttonRect = el.getBoundingClientRect();
  // QMenuは展開する方向のスペースが不足している場合、自動的に展開方向を変更してしまうためmax-heightで制限する。
  // AudioDetailよりボタンが下に来ることはないのでその最低高185pxに余裕を持たせた170pxを最小の高さにする。
  // pxで指定するとウインドウサイズ変更に追従できないので ウインドウの高さの96% - ボタンの下端の座標 でメニューの高さを決定する。
  maxMenuHeight.value = `max(170px, min(${heightLimit}, calc(96vh - ${buttonRect.bottom}px)))`;
};
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
