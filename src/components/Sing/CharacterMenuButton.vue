<template>
  <q-btn flat class="q-pa-none">
    <div v-if="isLoading" class="selected-character">
      <q-skeleton class="character-avatar" type="QAvatar" size="52px" />
      <div class="character-info">
        <q-skeleton
          class="character-name skeleton"
          type="rect"
          width="65px"
          height="15px"
        />
        <q-skeleton
          class="character-style"
          type="rect"
          width="110px"
          height="12px"
        />
      </div>
    </div>
    <div v-else class="selected-character">
      <q-avatar
        v-if="selectedStyleIconPath"
        class="character-avatar"
        size="3.5rem"
      >
        <img :src="selectedStyleIconPath" class="character-avatar-icon" />
      </q-avatar>
      <div class="character-info">
        <div class="character-name">
          {{ selectedCharacterName }}
        </div>
        <div class="character-style">
          {{ selectedCharacterStyleDescription }}
        </div>
      </div>
      <q-icon
        name="arrow_drop_down"
        size="sm"
        class="character-menu-dropdown-icon"
      />
    </div>
    <q-menu
      class="character-menu"
      transition-show="none"
      transition-hide="none"
      touch-position
    >
      <q-list>
        <q-item
          v-for="(characterInfo, characterIndex) in userOrderedCharacterInfos"
          :key="characterIndex"
          class="q-pa-none"
        >
          <q-btn-group flat class="col full-width">
            <q-btn
              v-close-popup
              flat
              no-caps
              class="col-grow"
              :class="
                characterInfo.metas.speakerUuid === selectedSpeakerUuid &&
                'selected-character-item'
              "
              @click="
                changeStyleId(
                  characterInfo.metas.speakerUuid,
                  getDefaultStyle(characterInfo.metas.speakerUuid).styleId
                )
              "
              @mouseover="reassignSubMenuOpen(-1)"
              @mouseleave="reassignSubMenuOpen.cancel()"
            >
              <q-avatar rounded size="2rem" class="q-mr-md">
                <q-img
                  no-spinner
                  no-transition
                  :ratio="1"
                  :src="
                    getDefaultStyle(characterInfo.metas.speakerUuid).iconPath
                  "
                />
                <q-avatar
                  v-if="
                    isMultipleEngine && characterInfo.metas.styles.length < 2
                  "
                  class="engine-icon"
                  rounded
                >
                  <img
                    :src="
                      engineIcons[
                        getDefaultStyle(characterInfo.metas.speakerUuid)
                          .engineId
                      ]
                    "
                  />
                </q-avatar>
              </q-avatar>
              <div>{{ characterInfo.metas.speakerName }}</div>
            </q-btn>

            <!-- スタイルが2つ以上あるものだけ、スタイル選択ボタンを表示する-->
            <template v-if="characterInfo.metas.styles.length >= 2">
              <q-separator vertical />

              <div
                class="flex items-center q-px-sm q-py-none cursor-pointer"
                :class="
                  subMenuOpenFlags[characterIndex] && 'opened-character-item'
                "
                @mouseover="reassignSubMenuOpen(characterIndex)"
                @mouseleave="reassignSubMenuOpen.cancel()"
              >
                <q-icon name="keyboard_arrow_right" color="grey-6" size="sm" />

                <q-menu
                  v-model="subMenuOpenFlags[characterIndex]"
                  no-parent-event
                  anchor="top end"
                  self="top start"
                  transition-show="none"
                  transition-hide="none"
                  class="character-menu"
                >
                  <q-list>
                    <q-item
                      v-for="(style, styleIndex) in characterInfo.metas.styles"
                      :key="styleIndex"
                      v-close-popup
                      clickable
                      active-class="selected-character-item"
                      :active="style.styleId === selectedStyleId"
                      @click="
                        changeStyleId(
                          characterInfo.metas.speakerUuid,
                          style.styleId
                        )
                      "
                    >
                      <q-avatar rounded size="2rem" class="q-mr-md">
                        <q-img
                          no-spinner
                          no-transition
                          :ratio="1"
                          :src="style.iconPath"
                        />
                        <q-avatar
                          v-if="isMultipleEngine"
                          rounded
                          class="engine-icon"
                        >
                          <img :src="engineIcons[style.engineId]" />
                        </q-avatar>
                      </q-avatar>
                      <q-item-section v-if="style.styleName">
                        {{ characterInfo.metas.speakerName }} ({{
                          getStyleDescription(style)
                        }})
                      </q-item-section>
                      <q-item-section v-else>{{
                        characterInfo.metas.speakerName
                      }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </div>
            </template>
          </q-btn-group>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { debounce } from "quasar";
import { useStore } from "@/store";
import { base64ImageToUri } from "@/helpers/imageHelper";
import { SpeakerId, StyleId } from "@/type/preload";
import { getStyleDescription } from "@/sing/viewHelper";

const store = useStore();

const userOrderedCharacterInfos = computed(() => {
  return store.getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
});

const subMenuOpenFlags = ref(
  [...Array(userOrderedCharacterInfos.value?.length)].map(() => false)
);

const reassignSubMenuOpen = debounce((idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  const arr = [...Array(userOrderedCharacterInfos.value?.length)].map(
    () => false
  );
  arr[idx] = true;
  subMenuOpenFlags.value = arr;
}, 100);
const selectedCharacterInfo = computed(() => {
  if (
    userOrderedCharacterInfos.value == undefined ||
    store.state.singer == undefined
  )
    return undefined;
  return store.getters.CHARACTER_INFO(
    store.state.singer.engineId,
    store.state.singer.styleId
  );
});

const isLoading = computed(() => {
  return selectedCharacterInfo.value == undefined;
});

const selectedSpeakerUuid = computed(() => {
  return selectedCharacterInfo.value?.metas.speakerUuid;
});

const selectedStyleId = computed(
  () =>
    selectedCharacterInfo.value?.metas.styles.find(
      (style) =>
        style.styleId === store.state.singer?.styleId &&
        style.engineId === store.state.singer?.engineId
    )?.styleId
);

const selectedCharacterName = computed(() => {
  return selectedCharacterInfo.value?.metas.speakerName;
});
const selectedCharacterStyleDescription = computed(() => {
  const style = selectedCharacterInfo.value?.metas.styles.find((style) => {
    return (
      style.styleId === store.state.singer?.styleId &&
      style.engineId === store.state.singer?.engineId
    );
  });
  return style != undefined ? getStyleDescription(style) : "";
});
const selectedStyleIconPath = computed(() => {
  const styles = selectedCharacterInfo.value?.metas.styles;
  return styles?.find((style) => {
    return (
      style.styleId === store.state.singer?.styleId &&
      style.engineId === store.state.singer?.engineId
    );
  })?.iconPath;
});

const changeStyleId = (speakerUuid: SpeakerId, styleId: StyleId) => {
  const engineId = store.state.engineIds.find((_engineId) =>
    (store.state.characterInfos[_engineId] ?? []).some(
      (characterInfo) =>
        characterInfo.metas.speakerUuid === speakerUuid &&
        characterInfo.metas.styles.some((style) => style.styleId === styleId)
    )
  );
  if (engineId == undefined)
    throw new Error(
      `No engineId for target character style (speakerUuid == ${speakerUuid}, styleId == ${styleId})`
    );

  store.dispatch("SET_SINGER", { singer: { engineId, styleId } });
};

const getDefaultStyle = (speakerUuid: string) => {
  // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
  const characterInfo = userOrderedCharacterInfos.value?.find(
    (info) => info.metas.speakerUuid === speakerUuid
  );

  // ここで取得されるcharacterInfoには、ソングエディタ向けのスタイルのみ含まれるので、
  // その中の最初のスタイルをソングエディタにおける仮のデフォルトスタイルとする
  // TODO: ソングエディタ向けのデフォルトスタイルをどうするか考える
  const defaultStyleId = characterInfo?.metas.styles[0].styleId;

  const defaultStyle = characterInfo?.metas.styles.find(
    (style) => style.styleId === defaultStyleId
  );

  if (defaultStyle == undefined) throw new Error("defaultStyle == undefined");

  return defaultStyle;
};

// 複数エンジン
const isMultipleEngine = computed(() => store.state.engineIds.length > 1);

const engineIcons = computed(() =>
  Object.fromEntries(
    store.state.engineIds.map((engineId) => [
      engineId,
      base64ImageToUri(store.state.engineManifests[engineId].icon),
    ])
  )
);
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.selected-character {
  align-items: center;
  display: flex;
  padding: 0.25rem 0.5rem 0.25rem 0.25rem;
  position: relative;

  .character-avatar-icon {
    display: block;
    height: 100%;
    object-fit: cover;
    width: 100%;
  }

  .character-info {
    align-items: start;
    display: flex;
    flex-direction: column;
    margin-left: 0.5rem;
    text-align: left;
    justify-content: center;
    white-space: nowrap;
  }
  .character-name {
    font-size: 0.875rem;
    font-weight: bold;
    line-height: 1rem;
    padding-top: 0.5rem;

    &.skeleton {
      margin-top: 0.4rem;
      margin-bottom: 0.2rem;
    }
  }

  .character-style {
    color: #999;
    font-size: 0.75rem;
    font-weight: bold;
    line-height: 1rem;
  }

  .character-menu-dropdown-icon {
    color: rgba(0, 0, 0, 0.54);
    margin-left: 0.25rem;
  }
}

.character-menu {
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
  .selected-character-item,
  .opened-character-item {
    background-color: rgba(colors.$primary-rgb, 0.2);
  }
  .engine-icon {
    position: absolute;
    width: 13px;
    height: 13px;
    bottom: -6px;
    right: -6px;
  }
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
}
</style>
