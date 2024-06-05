<template>
  <QBtn flat class="q-pa-none" :disable="uiLocked">
    <SelectedCharacter :showSkeleton :selectedCharacterInfo :selectedSinger />
    <QMenu
      class="character-menu"
      transitionShow="none"
      transitionHide="none"
      touchPosition
    >
      <QList>
        <QItem
          v-for="(characterInfo, characterIndex) in userOrderedCharacterInfos"
          :key="characterIndex"
          class="q-pa-none"
        >
          <QBtnGroup flat class="col full-width">
            <QBtn
              v-close-popup
              flat
              noCaps
              class="col-grow"
              :class="
                characterInfo.metas.speakerUuid === selectedSpeakerUuid &&
                'selected-character-item'
              "
              @click="
                changeStyleId(
                  characterInfo.metas.speakerUuid,
                  getDefaultStyle(characterInfo.metas.speakerUuid).styleId,
                )
              "
              @mouseover="reassignSubMenuOpen(-1)"
              @mouseleave="reassignSubMenuOpen.cancel()"
            >
              <QAvatar rounded size="2rem" class="q-mr-md">
                <QImg
                  noSpinner
                  noTransition
                  :ratio="1"
                  :src="
                    getDefaultStyle(characterInfo.metas.speakerUuid).iconPath
                  "
                />
                <QAvatar
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
                </QAvatar>
              </QAvatar>
              <div>{{ characterInfo.metas.speakerName }}</div>
            </QBtn>

            <!-- スタイルが2つ以上あるものだけ、スタイル選択ボタンを表示する-->
            <template v-if="characterInfo.metas.styles.length >= 2">
              <QSeparator vertical />

              <div
                class="flex items-center q-px-sm q-py-none cursor-pointer"
                :class="
                  subMenuOpenFlags[characterIndex] && 'opened-character-item'
                "
                @mouseover="reassignSubMenuOpen(characterIndex)"
                @mouseleave="reassignSubMenuOpen.cancel()"
              >
                <QIcon name="keyboard_arrow_right" color="grey-6" size="sm" />

                <QMenu
                  v-model="subMenuOpenFlags[characterIndex]"
                  noParentEvent
                  anchor="top end"
                  self="top start"
                  transitionShow="none"
                  transitionHide="none"
                  class="character-menu"
                >
                  <QList>
                    <QItem
                      v-for="(style, styleIndex) in characterInfo.metas.styles"
                      :key="styleIndex"
                      v-close-popup
                      clickable
                      activeClass="selected-character-item"
                      :active="style.styleId === selectedStyleId"
                      @click="
                        changeStyleId(
                          characterInfo.metas.speakerUuid,
                          style.styleId,
                        )
                      "
                    >
                      <QAvatar rounded size="2rem" class="q-mr-md">
                        <QImg
                          noSpinner
                          noTransition
                          :ratio="1"
                          :src="style.iconPath"
                        />
                        <QAvatar
                          v-if="isMultipleEngine"
                          rounded
                          class="engine-icon"
                        >
                          <img :src="engineIcons[style.engineId]" />
                        </QAvatar>
                      </QAvatar>
                      <QItemSection v-if="style.styleName">
                        {{ characterInfo.metas.speakerName }} ({{
                          getStyleDescription(style)
                        }})
                      </QItemSection>
                      <QItemSection v-else>{{
                        characterInfo.metas.speakerName
                      }}</QItemSection>
                    </QItem>
                  </QList>
                </QMenu>
              </div>
            </template>
          </QBtnGroup>
        </QItem>
      </QList>
    </QMenu>
  </QBtn>
</template>

<script lang="ts">
export default {
  name: "CharacterMenuButton",
};
</script>
<script setup lang="ts">
import { computed, ref } from "vue";
import { debounce } from "quasar";
import SelectedCharacter from "./SelectedCharacter.vue";
import { useStore } from "@/store";
import { SpeakerId, StyleId } from "@/type/preload";
import { getStyleDescription } from "@/sing/viewHelper";
import { useEngineIcons } from "@/composables/useEngineIcons";

const store = useStore();
const uiLocked = computed(() => store.getters.UI_LOCKED);

const userOrderedCharacterInfos = computed(() => {
  return store.getters.USER_ORDERED_CHARACTER_INFOS("singerLike");
});

const subMenuOpenFlags = ref(
  [...Array(userOrderedCharacterInfos.value?.length)].map(() => false),
);

const reassignSubMenuOpen = debounce((idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  const arr = [...Array(userOrderedCharacterInfos.value?.length)].map(
    () => false,
  );
  arr[idx] = true;
  subMenuOpenFlags.value = arr;
}, 100);
const showSkeleton = computed(() => selectedCharacterInfo.value == undefined);

const changeStyleId = (speakerUuid: SpeakerId, styleId: StyleId) => {
  const engineId = store.state.engineIds.find((_engineId) =>
    (store.state.characterInfos[_engineId] ?? []).some(
      (characterInfo) =>
        characterInfo.metas.speakerUuid === speakerUuid &&
        characterInfo.metas.styles.some((style) => style.styleId === styleId),
    ),
  );
  if (engineId == undefined)
    throw new Error(
      `No engineId for target character style (speakerUuid == ${speakerUuid}, styleId == ${styleId})`,
    );

  store.dispatch("COMMAND_SET_SINGER", {
    singer: { engineId, styleId },
    withRelated: true,
  });
};

const getDefaultStyle = (speakerUuid: string) => {
  // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
  const characterInfo = userOrderedCharacterInfos.value?.find(
    (info) => info.metas.speakerUuid === speakerUuid,
  );

  // ここで取得されるcharacterInfoには、ソングエディタ向けのスタイルのみ含まれるので、
  // その中の最初のスタイルをソングエディタにおける仮のデフォルトスタイルとする
  const defaultStyleId = characterInfo?.metas.styles[0].styleId;

  const defaultStyle = characterInfo?.metas.styles.find(
    (style) => style.styleId === defaultStyleId,
  );

  if (defaultStyle == undefined) throw new Error("defaultStyle == undefined");

  return defaultStyle;
};

const selectedCharacterInfo = computed(() => {
  const singer = store.getters.SELECTED_TRACK.singer;
  if (userOrderedCharacterInfos.value == undefined || !singer) {
    return undefined;
  }
  return store.getters.CHARACTER_INFO(singer.engineId, singer.styleId);
});

const selectedSinger = computed(() => {
  return store.getters.SELECTED_TRACK.singer;
});

const selectedSpeakerUuid = computed(() => {
  return selectedCharacterInfo.value?.metas.speakerUuid;
});

const selectedStyleId = computed(
  () =>
    selectedCharacterInfo.value?.metas.styles.find(
      (style) =>
        style.styleId === store.getters.SELECTED_TRACK.singer?.styleId &&
        style.engineId === store.getters.SELECTED_TRACK.singer?.engineId,
    )?.styleId,
);

// 複数エンジン
const isMultipleEngine = computed(() => store.state.engineIds.length > 1);

const engineIcons = useEngineIcons(() => store.state.engineManifests);
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

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
  .engine-icon {
    position: absolute;
    width: 13px;
    height: 13px;
    bottom: -6px;
    right: -6px;
  }
}
</style>
