<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger asChild>
      <slot
        name="trigger"
        :disabled="uiLocked || characterOptions.length === 0"
      />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        class="SingerMenuContent"
        align="start"
        :sideOffset="4"
        :collisionPadding="8"
        avoidCollisions
        hideWhenDetached
      >
        <template
          v-for="(characterOption, characterIndex) in characterOptions"
          :key="`${characterOption.metas.speakerUuid}:${characterIndex}`"
        >
          <DropdownMenuSub v-if="characterOption.metas.styles.length >= 2">
            <div class="SingerCharacterRow">
              <DropdownMenuItem
                class="SingerMenuItem"
                :class="{
                  selected:
                    characterOption.metas.speakerUuid === selectedSpeakerUuid,
                }"
                @select="setSinger(getDefaultStyle(characterOption))"
              >
                <SingerIcon
                  rounded
                  size="32px"
                  :style="getDefaultStyle(characterOption)"
                  :showEngineIcon="isMultipleEngine"
                  :engineIcons
                />
                <span class="SingerMenuLabel">
                  {{ characterOption.metas.speakerName }}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSubTrigger
                class="SingerSubMenuTrigger"
                :aria-label="`${characterOption.metas.speakerName}のスタイルを選択`"
              >
                <span
                  class="SingerSubMenuIcon material-symbols-outlined"
                  aria-hidden="true"
                >
                  chevron_right
                </span>
              </DropdownMenuSubTrigger>
            </div>

            <DropdownMenuPortal>
              <DropdownMenuSubContent
                class="SingerSubMenuContent"
                :sideOffset="4"
                :collisionPadding="8"
                avoidCollisions
              >
                <DropdownMenuItem
                  v-for="style in characterOption.metas.styles"
                  :key="`${style.engineId}:${style.styleId}`"
                  class="SingerMenuItem SingerStyleItem"
                  :class="{ selected: isSelectedStyle(style) }"
                  @select="setSinger(style)"
                >
                  <SingerIcon
                    rounded
                    size="32px"
                    :style
                    :showEngineIcon="isMultipleEngine"
                    :engineIcons
                  />
                  <span class="SingerMenuLabel">
                    {{ getSingerStyleLabel(characterOption, style) }}
                  </span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            v-else
            class="SingerMenuItem"
            :class="{
              selected:
                characterOption.metas.speakerUuid === selectedSpeakerUuid,
            }"
            @select="setSinger(getDefaultStyle(characterOption))"
          >
            <SingerIcon
              rounded
              size="32px"
              :style="getDefaultStyle(characterOption)"
              :showEngineIcon="isMultipleEngine"
              :engineIcons
            />
            <span class="SingerMenuLabel">
              {{ characterOption.metas.speakerName }}
            </span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "reka-ui";
import SingerIcon from "@/components/Sing/SingerIcon.vue";
import { useEngineIcons } from "@/composables/useEngineIcons";
import { getOrThrow } from "@/helpers/mapHelper";
import { getStyleDescription } from "@/sing/viewHelper";
import { useStore } from "@/store";
import type { CharacterInfo, StyleInfo, TrackId } from "@/type/preload";

defineOptions({
  name: "CharacterSelectMenu",
});

const props = defineProps<{
  trackId: TrackId;
}>();

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);
const track = computed(() => getOrThrow(store.state.tracks, props.trackId));
const singer = computed(() => track.value.singer);
const characterOptions = computed(
  () => store.getters.USER_ORDERED_CHARACTER_INFOS("singerLike") ?? [],
);

const selectedCharacterInfo = computed(() => {
  const currentSinger = singer.value;
  if (currentSinger == undefined) {
    return undefined;
  }
  return store.getters.CHARACTER_INFO(
    currentSinger.engineId,
    currentSinger.styleId,
  );
});

const selectedSpeakerUuid = computed(
  () => selectedCharacterInfo.value?.metas.speakerUuid,
);

const getDefaultStyle = (characterInfo: CharacterInfo) => {
  const defaultStyle = characterInfo.metas.styles[0];
  if (defaultStyle == undefined) {
    throw new Error("Default singer style is not found.");
  }
  return defaultStyle;
};

const getSingerStyleLabel = (
  characterInfo: CharacterInfo,
  style: StyleInfo,
) => {
  return style.styleName == undefined
    ? characterInfo.metas.speakerName
    : `${characterInfo.metas.speakerName}（${getStyleDescription(style)}）`;
};

const isSelectedStyle = (style: StyleInfo) => {
  const currentSinger = singer.value;
  return (
    currentSinger != undefined &&
    style.engineId === currentSinger.engineId &&
    style.styleId === currentSinger.styleId
  );
};

const setSinger = (style: StyleInfo) => {
  void store.actions.COMMAND_SET_SINGER({
    trackId: props.trackId,
    singer: { engineId: style.engineId, styleId: style.styleId },
    withRelated: true,
  });
};

const isMultipleEngine = computed(() => store.state.engineIds.length > 1);
const engineIcons = useEngineIcons(() => store.state.engineManifests);
</script>

<style lang="scss">
@use "@/styles/v2/variables" as vars;

.SingerMenuContent,
.SingerSubMenuContent {
  min-width: 280px;
  max-height: var(--reka-dropdown-menu-content-available-height);
  padding: vars.$padding-1;
  overflow: hidden auto;
  border: 1px solid var(--scheme-color-outline-variant);
  border-radius: vars.$radius-2;
  color: var(--scheme-color-on-surface);
  background-color: var(--scheme-color-surface);
  box-shadow: 0 2px 4px
    color-mix(in oklch, var(--scheme-color-shadow) 5%, transparent);
  z-index: vars.$z-index-dropdown;

  &::-webkit-scrollbar {
    width: vars.$size-scrollbar;
    height: vars.$size-scrollbar;
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    border: 4px solid transparent;
    border-radius: vars.$size-scrollbar;
    background-color: color-mix(
      in oklch,
      var(--scheme-color-on-surface) 30%,
      transparent
    );
    background-clip: content-box;

    &:hover {
      background-color: color-mix(
        in oklch,
        var(--scheme-color-on-surface) 40%,
        transparent
      );
    }

    &:active {
      background-color: color-mix(
        in oklch,
        var(--scheme-color-on-surface) 50%,
        transparent
      );
    }
  }

  &::-webkit-scrollbar-corner {
    background: transparent;
  }
}

.SingerCharacterRow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) vars.$size-listitem;
}

.SingerMenuItem,
.SingerSubMenuTrigger {
  min-height: vars.$size-listitem;
  border-radius: vars.$radius-1;
  cursor: pointer;
  outline: none;

  &[data-highlighted] {
    background-color: var(--scheme-color-surface-container-high);
  }

  &:focus-visible {
    outline: 2px solid var(--scheme-color-primary);
    outline-offset: -2px;
  }
}

.SingerMenuItem {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 4px vars.$padding-2;
  gap: vars.$gap-1;

  &::before {
    position: absolute;
    left: 6px;
    width: 4px;
    height: 0;
    border-radius: 2px;
    background-color: var(--scheme-color-primary-fixed-dim);
    opacity: 0;
    content: "";
    transition-duration: vars.$transition-duration;
    transition-property: height opacity;
  }

  &.selected {
    color: var(--scheme-color-on-secondary-container);
    background-color: var(--scheme-color-secondary-container);

    &::before {
      height: 16px;
      opacity: 1;
    }
  }
}

.SingerSubMenuTrigger {
  display: grid;
  place-items: center;
}

.SingerSubMenuIcon {
  font-size: 24px;
}

.SingerMenuLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 20px;
}
</style>
