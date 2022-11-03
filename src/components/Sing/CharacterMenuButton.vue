<template>
  <q-btn flat class="q-pa-none">
    <slot />
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
              flat
              no-caps
              v-close-popup
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
                  class="engine-icon"
                  rounded
                  v-if="
                    isMultipleEngine && characterInfo.metas.styles.length < 2
                  "
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
                          :src="characterInfo.metas.styles[styleIndex].iconPath"
                        />
                        <q-avatar
                          rounded
                          class="engine-icon"
                          v-if="isMultipleEngine"
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
import { defineComponent, computed, ref } from "vue";
import { debounce } from "quasar";
import { useStore } from "@/store";
import { base64ImageToUri } from "@/helpers/imageHelper";

export default defineComponent({
  name: "CharacterMenuButton",

  setup() {
    const store = useStore();

    const userOrderedCharacterInfos = computed(
      () => store.getters.USER_ORDERED_CHARACTER_INFOS
    );

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

    const changeStyleId = (speakerUuid: string, styleId: number) => {
      const engineId = store.state.engineIds.find((_engineId) =>
        (store.state.characterInfos[_engineId] ?? []).some(
          (characterInfo) =>
            characterInfo.metas.speakerUuid === speakerUuid &&
            characterInfo.metas.styles.some(
              (style) => style.styleId === styleId
            )
        )
      );
      if (engineId === undefined)
        throw new Error(
          `No engineId for target character style (speakerUuid == ${speakerUuid}, styleId == ${styleId})`
        );

      store.dispatch("SET_SINGER", { engineId, styleId });
    };

    const getDefaultStyle = (speakerUuid: string) => {
      // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
      const characterInfo = userOrderedCharacterInfos.value?.find(
        (info) => info.metas.speakerUuid === speakerUuid
      );
      const defaultStyleId = store.state.defaultStyleIds.find(
        (x) => x.speakerUuid === speakerUuid
      )?.defaultStyleId;

      return characterInfo?.metas.styles.find(
        (style) => style.styleId === defaultStyleId
      );
    };

    const selectedCharacterInfo = computed(() => {
      if (
        userOrderedCharacterInfos.value === undefined ||
        store.state.engineId === undefined ||
        store.state.styleId === undefined
      )
        return undefined;
      return store.getters.CHARACTER_INFO(
        store.state.engineId,
        store.state.styleId
      );
    });

    const selectedSpeakerUuid = computed(() => {
      return selectedCharacterInfo.value?.metas.speakerUuid;
    });

    const selectedStyleId = computed(
      () =>
        selectedCharacterInfo.value?.metas.styles.find(
          (style) =>
            style.styleId === store.state.styleId &&
            style.engineId === store.state.engineId
        )?.styleId
    );

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

    return {
      userOrderedCharacterInfos,
      subMenuOpenFlags,
      reassignSubMenuOpen,
      changeStyleId,
      getDefaultStyle,
      selectedCharacterInfo,
      selectedSpeakerUuid,
      selectedStyleId,
      isMultipleEngine,
      engineIcons,
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
