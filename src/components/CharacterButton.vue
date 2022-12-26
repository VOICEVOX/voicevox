<script setup lang="ts">
import { base64ImageToUri } from "@/helpers/imageHelper";
import { useStore } from "@/store";
import { CharacterInfo, Voice } from "@/type/preload";
import { debounce } from "quasar";
import { computed, ref } from "vue";

const props =
  defineProps<{
    characterInfos: CharacterInfo[];
    loading: boolean;
    selectedVoice: Voice;
    showEngineInfo: boolean;
    emptiable: boolean;
    uiLocked: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:selectedVoice", value: Voice | undefined): void;
  }>();

const store = useStore();

const selectedCharacter = computed(() => {
  const selectedVoice = props.selectedVoice;
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

const selectedStyleInfo = computed(() => {
  const selectedVoice = props.selectedVoice;
  const style = selectedCharacter.value?.metas.styles.find(
    (style) =>
      style.engineId === selectedVoice?.engineId &&
      style.styleId === selectedVoice.styleId
  );
  return style;
});

const engineIcons = computed(() =>
  Object.fromEntries(
    store.state.engineIds.map((engineId) => [
      engineId,
      base64ImageToUri(store.state.engineManifests[engineId].icon),
    ])
  )
);

const getDefaultStyle = (speakerUuid: string) => {
  // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
  const characterInfo = props.characterInfos.find(
    (info) => info.metas.speakerUuid === speakerUuid
  );
  const defaultStyleId = store.state.defaultStyleIds.find(
    (x) => x.speakerUuid === speakerUuid
  )?.defaultStyleId;

  const defaultStyle = characterInfo?.metas.styles.find(
    (style) => style.styleId === defaultStyleId
  );

  if (defaultStyle == undefined) throw new Error("defaultStyle == undefined");

  return defaultStyle;
};

const onSelectSpeaker = (speakerUuid: string) => {
  const style = getDefaultStyle(speakerUuid);
  emit("update:selectedVoice", {
    engineId: style.engineId,
    speakerId: speakerUuid,
    styleId: style.styleId,
  });
};

const subMenuOpenFlags = ref(
  [...Array(props.characterInfos.length)].map(() => false)
);

const reassignSubMenuOpen = debounce((idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  const arr = [...Array(props.characterInfos.length)].map(() => false);
  arr[idx] = true;
  subMenuOpenFlags.value = arr;
}, 100);
</script>

<template>
  <QBtn
    flat
    class="q-pa-none character-button"
    :disable="uiLocked"
    :class="{ opaque: loading }"
  >
    <!-- q-imgだとdisableのタイミングで点滅する -->
    <div class="icon-container">
      <img
        v-if="selectedStyleInfo != undefined"
        class="q-pa-none q-ma-none"
        :src="selectedStyleInfo.iconPath"
      />
      <QAvatar v-else-if="!emptiable" rounded size="2rem" color="primary"
        ><span color="text-display-on-primary">?</span></QAvatar
      >
    </div>
    <div v-if="loading" class="loading">
      <QSpinner color="primary" size="1.6rem" :thickness="7" />
    </div>
    <QMenu class="character-menu" transition-show="none" transition-hide="none">
      <QList>
        <QItem
          v-if="selectedStyleInfo == undefined"
          class="row no-wrap items-center"
        >
          <span class="text-warning vertical-middle"
            >有効なスタイルが選択されていません</span
          >
        </QItem>
        <QItem
          v-if="characterInfos.length === 0"
          class="row no-wrap items-center"
        >
          <span class="text-warning vertical-middle"
            >選択可能なスタイルがありません</span
          >
        </QItem>
        <QItem v-if="emptiable" class="q-pa-none">
          <QBtn
            flat
            no-caps
            v-close-popup
            class="full-width"
            :class="selectedCharacter == undefined && 'selected-character-item'"
            @click="$emit('update:selectedVoice', undefined)"
          >
            <span>選択解除</span>
          </QBtn>
        </QItem>
        <QItem
          v-for="(characterInfo, characterIndex) in characterInfos"
          :key="characterIndex"
          class="q-pa-none"
        >
          <QBtnGroup flat class="col full-width">
            <QBtn
              flat
              no-caps
              v-close-popup
              class="col-grow"
              :class="
                selectedCharacter != undefined &&
                characterInfo.metas.speakerUuid ===
                  selectedCharacter.metas.speakerUuid &&
                'selected-character-item'
              "
              @click="onSelectSpeaker(characterInfo.metas.speakerUuid)"
              @mouseover="reassignSubMenuOpen(-1)"
              @mouseleave="reassignSubMenuOpen.cancel()"
            >
              <QAvatar rounded size="2rem" class="q-mr-md">
                <QImg
                  v-if="characterInfo"
                  no-spinner
                  no-transition
                  :ratio="1"
                  :src="
                    getDefaultStyle(characterInfo.metas.speakerUuid).iconPath
                  "
                />
                <QAvatar
                  class="engine-icon"
                  rounded
                  v-if="showEngineInfo && characterInfo.metas.styles.length < 2"
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
                  no-parent-event
                  anchor="top end"
                  self="top start"
                  transition-show="none"
                  transition-hide="none"
                  class="character-menu"
                  v-model="subMenuOpenFlags[characterIndex]"
                >
                  <QList>
                    <QItem
                      v-for="(style, styleIndex) in characterInfo.metas.styles"
                      :key="styleIndex"
                      clickable
                      v-close-popup
                      active-class="selected-character-item"
                      :active="
                        selectedVoice != undefined &&
                        style.styleId === selectedVoice.styleId
                      "
                      @click="
                        $emit('update:selectedVoice', {
                          engineId: style.engineId,
                          speakerId: characterInfo.metas.speakerUuid,
                          styleId: style.styleId,
                        })
                      "
                    >
                      <QAvatar rounded size="2rem" class="q-mr-md">
                        <QImg
                          no-spinner
                          no-transition
                          :ratio="1"
                          :src="characterInfo.metas.styles[styleIndex].iconPath"
                        />
                        <QAvatar
                          rounded
                          class="engine-icon"
                          v-if="showEngineInfo"
                        >
                          <img
                            :src="
                              engineIcons[
                                characterInfo.metas.styles[styleIndex].engineId
                              ]
                            "
                          />
                        </QAvatar>
                      </QAvatar>
                      <QItemSection v-if="style.styleName"
                        >{{ characterInfo.metas.speakerName }} ({{
                          style.styleName
                        }})</QItemSection
                      >
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

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.character-button {
  border: solid 1px;
  border-color: colors.$primary-light;
  font-size: 0;
  height: fit-content;

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
}
</style>
