<template>
  <q-btn
    flat
    class="q-pa-none character-button"
    :disable="uiLocked"
    :class="{ opaque: loading }"
  >
    <!-- q-imgだとdisableのタイミングで点滅する -->
    <img class="q-pa-none q-ma-none" :src="selectedStyleInfo.iconPath" />
    <div v-if="loading" class="loading">
      <q-spinner color="primary" size="1.6rem" :thickness="7" />
    </div>
    <q-menu
      class="character-menu"
      transition-show="none"
      transition-hide="none"
    >
      <q-list>
        <q-item
          v-for="(characterInfo, characterIndex) in characterInfos"
          :key="characterIndex"
          class="q-pa-none"
        >
          <q-btn-group flat class="col full-width">
            <q-btn
              flat
              no-caps
              v-close-popup
              class="col-grow"
              :class="
                characterInfo.metas.speakerUuid ===
                  selectedCharacter.metas.speakerUuid &&
                'selected-character-item'
              "
              @click="onSelectSpeaker(characterInfo.metas.speakerUuid)"
              @mouseover="reassignSubMenuOpen(-1)"
              @mouseleave="reassignSubMenuOpen.cancel()"
            >
              <q-avatar rounded size="2rem" class="q-mr-md">
                <q-img
                  v-if="characterInfo"
                  no-spinner
                  no-transition
                  :ratio="1"
                  :src="
                    getDefaultStyle(characterInfo.metas.speakerUuid).iconPath
                  "
                />
                <q-avatar
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
                  no-parent-event
                  anchor="top end"
                  self="top start"
                  transition-show="none"
                  transition-hide="none"
                  class="character-menu"
                  v-model="subMenuOpenFlags[characterIndex]"
                >
                  <q-list>
                    <q-item
                      v-for="(style, styleIndex) in characterInfo.metas.styles"
                      :key="styleIndex"
                      clickable
                      v-close-popup
                      active-class="selected-character-item"
                      :active="style.styleId === selectedVoice.styleId"
                      @click="
                        $emit('update:selectedVoice', {
                          engineId: style.engineId,
                          speakerId: characterInfo.metas.speakerUuid,
                          styleId: style.styleId,
                        })
                      "
                    >
                      <q-avatar rounded size="2rem" class="q-mr-md">
                        <q-img
                          no-spinner
                          no-transition
                          :ratio="1"
                          :src="characterInfo.metas.styles[styleIndex].iconPath"
                        />
                        <q-avatar
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
                        </q-avatar>
                      </q-avatar>
                      <q-item-section v-if="style.styleName"
                        >{{ characterInfo.metas.speakerName }} ({{
                          style.styleName
                        }})</q-item-section
                      >
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

<script lang="ts">
import { base64ImageToUri } from "@/helpers/imageHelper";
import { useStore } from "@/store";
import { CharacterInfo, Voice } from "@/type/preload";
import { debounce } from "quasar";
import { computed, defineComponent, PropType, ref } from "vue";

export default defineComponent({
  name: "CharacterButton",

  props: {
    characterInfos: { type: Array as PropType<CharacterInfo[]>, required: true },
    loading: { type: Boolean, default: false },
    selectedVoice: { type: Object as PropType<Voice>, required: true },
    showEngineInfo: { type: Boolean, default: false },
    uiLocked: { type: Boolean, required: true },
  },

  emits: {
    "update:selectedVoice"(
      selectedStyle: Voice
    ) {
      return (
        typeof selectedStyle.engineId === "string" &&
        typeof selectedStyle.speakerId === "string" &&
        typeof selectedStyle.styleId === "number"
      );
    }
  },

  setup(props, { emit }) {
    const store = useStore();

    const selectedCharacter = computed(() => {
      const selectedVoice = props.selectedVoice;
      const character = props.characterInfos.find(characterInfo =>
        characterInfo.metas.speakerUuid === selectedVoice.speakerId
        && characterInfo.metas.styles.some(style =>
          style.engineId === selectedVoice.engineId
          && style.styleId === selectedVoice.styleId
        )
      );
      if (character == undefined) throw new Error("selectedVoiceのIDと一致するキャラクターが見つかりません");
      return character
    });

    const selectedStyleInfo = computed(() => {
      const selectedVoice = props.selectedVoice;
      const style = selectedCharacter.value.metas.styles.find(style =>
        style.engineId === selectedVoice.engineId && style.styleId === selectedVoice.styleId
      );
      if (style == undefined) throw new Error("selectedVoiceのIDと一致するスタイルが見つかりません");
      return style
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

      return defaultStyle
    };

    const onSelectSpeaker = (speakerUuid: string) => {
      const style = getDefaultStyle(speakerUuid);
      emit(
        "update:selectedVoice",
        {
          engineId: style.engineId,
          speakerId: speakerUuid,
          styleId: style.styleId
        }
      );
    }

    const subMenuOpenFlags = ref(
      [...Array(props.characterInfos.length)].map(() => false)
    );

    const reassignSubMenuOpen = debounce((idx: number) => {
      if (subMenuOpenFlags.value[idx]) return;
      const arr = [...Array(props.characterInfos.length)].map(
        () => false
      );
      arr[idx] = true;
      subMenuOpenFlags.value = arr;
    }, 100);

    return {
      selectedCharacter,
      selectedStyleInfo,
      engineIcons,
      getDefaultStyle,
      onSelectSpeaker,
      subMenuOpenFlags,
      reassignSubMenuOpen,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/colors' as colors;

.character-button {
  border: solid 1px;
  border-color: colors.$primary-light;
  font-size: 0;
  height: fit-content;

  img {
    height: 2rem;
    width: 2rem;
    object-fit: scale-down;
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
