<template>
  <QBtn
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
      <QAvatar v-else-if="!emptiable" rounded size="2rem" color="primary"
        ><span color="text-display-on-primary">?</span></QAvatar
      >
    </div>
    <div v-if="loading" class="loading">
      <QSpinner color="primary" size="1.6rem" :thickness="7" />
    </div>
    <QMenu
      class="character-menu"
      transitionShow="none"
      transitionHide="none"
      :max-height="maxMenuHeight"
      @beforeShow="updateMenuHeight"
    >
      <QList style="min-width: max-content" class="character-item-container">
        <QItem
          v-if="selectedStyleInfo == undefined && !emptiable"
          class="warning-item row no-wrap items-center"
        >
          <span class="text-warning vertical-middle"
            >有効なスタイルが選択されていません</span
          >
        </QItem>
        <QItem
          v-if="characterInfos.length === 0"
          class="warning-item row no-wrap items-center"
        >
          <span class="text-warning vertical-middle"
            >選択可能なスタイルがありません</span
          >
        </QItem>
        <QItem v-if="emptiable" class="to-unselect-item q-pa-none">
          <QBtn
            v-close-popup
            flat
            noCaps
            class="full-width"
            :class="selectedCharacter == undefined && 'selected-background'"
            @click="$emit('update:selectedVoice', undefined)"
          >
            <span>選択解除</span>
          </QBtn>
        </QItem>
        <QItem
          v-for="(characterInfo, characterIndex) in characterInfos"
          :key="characterIndex"
          class="q-pa-none"
          :class="isSelectedItem(characterInfo) && 'selected-character-item'"
        >
          <QBtnGroup flat class="col full-width">
            <QBtn
              v-close-popup
              flat
              noCaps
              class="col-grow"
              @click="onSelectSpeaker(characterInfo.metas.speakerUuid)"
              @mouseover="reassignSubMenuOpen(-1)"
              @mouseleave="reassignSubMenuOpen.cancel()"
            >
              <QAvatar rounded size="2rem" class="q-mr-md">
                <QImg
                  v-if="characterInfo"
                  noSpinner
                  noTransition
                  :ratio="1"
                  :src="
                    getDefaultStyleWrapper(characterInfo.metas.speakerUuid)
                      .iconPath
                  "
                />
                <QAvatar
                  v-if="showEngineInfo && characterInfo.metas.styles.length < 2"
                  class="engine-icon"
                  rounded
                >
                  <img
                    :src="
                      engineIcons[
                        getDefaultStyleWrapper(characterInfo.metas.speakerUuid)
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
                  subMenuOpenFlags[characterIndex] && 'selected-background'
                "
                role="application"
                :aria-label="`${characterInfo.metas.speakerName}のスタイル、マウスオーバーするか、右矢印キーを押してスタイル選択を表示できます`"
                tabindex="0"
                @mouseover="reassignSubMenuOpen(characterIndex)"
                @mouseleave="reassignSubMenuOpen.cancel()"
                @keyup.right="reassignSubMenuOpen(characterIndex)"
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
                  <QList style="min-width: max-content">
                    <QItem
                      v-for="(style, styleIndex) in characterInfo.metas.styles"
                      :key="styleIndex"
                      v-close-popup
                      clickable
                      activeClass="selected-style-item"
                      :active="
                        selectedVoice != undefined &&
                        style.styleId === selectedVoice.styleId
                      "
                      :aria-pressed="
                        selectedVoice != undefined &&
                        style.styleId === selectedVoice.styleId
                      "
                      role="button"
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
                          noSpinner
                          noTransition
                          :ratio="1"
                          :src="characterInfo.metas.styles[styleIndex].iconPath"
                        />
                        <QAvatar
                          v-if="showEngineInfo"
                          rounded
                          class="engine-icon"
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
                        >{{ characterInfo.metas.speakerName }}（{{
                          style.styleName
                        }}）</QItemSection
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

<script setup lang="ts">
import { debounce, QBtn } from "quasar";
import { computed, Ref, ref } from "vue";
import { useStore } from "@/store";
import { CharacterInfo, SpeakerId, Voice } from "@/type/preload";
import { formatCharacterStyleName } from "@/store/utility";
import { getDefaultStyle } from "@/domain/talk";
import { useEngineIcons } from "@/composables/useEngineIcons";

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
  },
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

const selectedCharacter = computed(() => {
  const selectedVoice = props.selectedVoice;
  if (selectedVoice == undefined) return undefined;
  const character = props.characterInfos.find(
    (characterInfo) =>
      characterInfo.metas.speakerUuid === selectedVoice?.speakerId &&
      characterInfo.metas.styles.some(
        (style) =>
          style.engineId === selectedVoice.engineId &&
          style.styleId === selectedVoice.styleId,
      ),
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
      style.styleId === selectedVoice.styleId,
  );
  return style;
});

const engineIcons = useEngineIcons(() => store.state.engineManifests);

const getDefaultStyleWrapper = (speakerUuid: SpeakerId) =>
  getDefaultStyle(
    speakerUuid,
    props.characterInfos,
    store.state.defaultStyleIds,
  );

const onSelectSpeaker = (speakerUuid: SpeakerId) => {
  const style = getDefaultStyleWrapper(speakerUuid);
  emit("update:selectedVoice", {
    engineId: style.engineId,
    speakerId: speakerUuid,
    styleId: style.styleId,
  });
};

const subMenuOpenFlags = ref(
  [...Array(props.characterInfos.length)].map(() => false),
);

const reassignSubMenuOpen = debounce((idx: number) => {
  if (subMenuOpenFlags.value[idx]) return;
  const arr = [...Array(props.characterInfos.length)].map(() => false);
  arr[idx] = true;
  subMenuOpenFlags.value = arr;
}, 100);

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
@use "@/styles/colors" as colors;

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
