<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="transparent-backdrop"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display">{{
              hasNewCharacter
                ? "追加キャラクターの紹介"
                : "設定 / キャラクター並び替え・試聴"
            }}</q-toolbar-title>
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              unelevated
              label="完了"
              color="toolbar-button"
              text-color="toolbar-button-display"
              class="text-no-wrap"
              @click="closeDialog"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-drawer
        bordered
        show-if-above
        :model-value="true"
        :width="$q.screen.width / 3 > 300 ? 300 : $q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="character-portrait-wrapper">
          <img
            :src="characterInfosMap[selectedCharacter].portraitPath"
            class="character-portrait"
          />
        </div>
      </q-drawer>

      <q-page-container>
        <q-page class="main">
          <div class="character-items-container">
            <span class="text-h6 q-py-md">サンプルボイス一覧</span>
            <div>
              <q-item
                v-for="speakerUuid of sampleCharacterOrder"
                :key="speakerUuid"
                clickable
                v-ripple="isHoverableItem"
                class="q-pa-none character-item"
                :class="[
                  isHoverableItem && 'hoverable-character-item',
                  selectedCharacter === speakerUuid &&
                    'selected-character-item',
                ]"
                @click="
                  selectCharacter(speakerUuid);
                  togglePlayOrStop(speakerUuid, selectedStyles[speakerUuid], 0);
                "
              >
                <div class="character-item-inner">
                  <img
                    :src="
                      characterInfosMap[speakerUuid].metas.styles[
                        selectedStyleIndexes[speakerUuid] ?? 0
                      ].iconPath
                    "
                    class="style-icon"
                  />
                  <span class="text-subtitle1 q-ma-sm">{{
                    characterInfosMap[speakerUuid].metas.speakerName
                  }}</span>
                  <div
                    v-if="
                      characterInfosMap[speakerUuid].metas.styles.length > 1
                    "
                    class="style-select-container"
                  >
                    <q-btn
                      flat
                      dense
                      icon="chevron_left"
                      text-color="display"
                      class="style-select-button"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectCharacter(speakerUuid);
                        rollStyleIndex(speakerUuid, -1);
                      "
                    />
                    <span>{{
                      selectedStyles[speakerUuid].styleName || "ノーマル"
                    }}</span>
                    <q-btn
                      flat
                      dense
                      icon="chevron_right"
                      text-color="display"
                      class="style-select-button"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectCharacter(speakerUuid);
                        rollStyleIndex(speakerUuid, 1);
                      "
                    />
                  </div>
                  <div class="voice-samples">
                    <q-btn
                      v-for="voiceSampleIndex of [...Array(3).keys()]"
                      :key="voiceSampleIndex"
                      round
                      outline
                      :icon="
                        playing != undefined &&
                        speakerUuid === playing.speakerUuid &&
                        selectedStyles[speakerUuid].styleId ===
                          playing.styleId &&
                        voiceSampleIndex === playing.index
                          ? 'stop'
                          : 'play_arrow'
                      "
                      color="primary-light"
                      class="voice-sample-btn"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectCharacter(speakerUuid);
                        togglePlayOrStop(
                          speakerUuid,
                          selectedStyles[speakerUuid],
                          voiceSampleIndex
                        );
                      "
                    />
                  </div>
                  <div
                    v-if="newCharacters.includes(speakerUuid)"
                    class="new-character-item q-pa-sm text-weight-bold"
                  >
                    NEW!
                  </div>
                </div>
              </q-item>
            </div>
          </div>

          <div class="character-order-container">
            <div class="text-subtitle1 text-weight-bold text-center q-py-md">
              キャラクター並び替え
            </div>
            <draggable
              class="character-order q-px-sm"
              v-model="characterOrder"
              :item-key="keyOfCharacterOrderItem"
              @start="characterOrderDragging = true"
              @end="characterOrderDragging = false"
            >
              <template v-slot:item="{ element }">
                <div
                  class="character-order-item q-py-sm"
                  :class="[
                    selectedCharacter === element.metas.speakerUuid &&
                      'selected-character-order-item',
                  ]"
                  @mouseenter="
                    // ドラッグ中はバグるので無視
                    characterOrderDragging ||
                      selectCharacter(element.metas.speakerUuid)
                  "
                >
                  {{ element.metas.speakerName }}
                </div>
              </template>
            </draggable>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, PropType, watch } from "vue";
import draggable from "vuedraggable";
import { useStore } from "@/store";
import { CharacterInfo, StyleInfo } from "@/type/preload";

export default defineComponent({
  name: "CharacterOrderDialog",
  components: {
    draggable,
  },

  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    characterInfos: {
      type: Object as PropType<CharacterInfo[]>,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();

    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const characterInfosMap = computed(() => {
      const map: { [key: string]: CharacterInfo } = {};
      props.characterInfos.forEach((characterInfo) => {
        map[characterInfo.metas.speakerUuid] = characterInfo;
      });
      return map;
    });

    // 新しいキャラクター
    const newCharacters = ref<string[]>([]);
    const hasNewCharacter = computed(() => newCharacters.value.length > 0);

    // サンプルボイス一覧のキャラクター順番
    const sampleCharacterOrder = ref<string[]>([]);

    // 選択中のスタイル
    const selectedStyleIndexes = ref<Record<string, number>>({});
    const selectedStyles = computed(() => {
      const map: { [key: string]: StyleInfo } = {};
      props.characterInfos.forEach((characterInfo) => {
        const selectedStyleIndex: number | undefined =
          selectedStyleIndexes.value[characterInfo.metas.speakerUuid];
        map[characterInfo.metas.speakerUuid] =
          characterInfo.metas.styles[selectedStyleIndex ?? 0];
      });
      return map;
    });

    // 選択中のキャラクター
    const selectedCharacter = ref(props.characterInfos[0].metas.speakerUuid);
    const selectCharacter = (speakerUuid: string) => {
      selectedCharacter.value = speakerUuid;
    };

    // キャラクター表示順序
    const characterOrder = ref<CharacterInfo[]>([]);

    // ダイアログが開かれたときに初期値を求める
    watch(
      () => props.modelValue,
      async (newValue, oldValue) => {
        if (!oldValue && newValue) {
          // 新しいキャラクター
          newCharacters.value = await store.dispatch("GET_NEW_CHARACTERS");

          // サンプルの順番、新しいキャラクターは上に
          sampleCharacterOrder.value = [
            ...newCharacters.value,
            ...props.characterInfos
              .filter(
                (info) => !newCharacters.value.includes(info.metas.speakerUuid)
              )
              .map((info) => info.metas.speakerUuid),
          ];

          selectedCharacter.value = sampleCharacterOrder.value[0];

          // 保存済みのキャラクターリストを取得
          // FIXME: 不明なキャラを無視しているので、不明キャラの順番が保存時にリセットされてしまう
          characterOrder.value = store.state.userCharacterOrder
            .map((speakerUuid) => characterInfosMap.value[speakerUuid])
            .filter((info) => info !== undefined) as CharacterInfo[];

          // 含まれていないキャラクターを足す
          const notIncludesCharacterInfos = props.characterInfos.filter(
            (characterInfo) =>
              !characterOrder.value.find(
                (characterInfoInList) =>
                  characterInfoInList.metas.speakerUuid ===
                  characterInfo.metas.speakerUuid
              )
          );
          characterOrder.value = [
            ...characterOrder.value,
            ...notIncludesCharacterInfos,
          ];
        }
      }
    );

    // draggable用
    const keyOfCharacterOrderItem = (item: CharacterInfo) =>
      item.metas.speakerUuid;

    // キャラクター枠のホバー状態を表示するかどうか
    // 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
    const isHoverableItem = ref(true);

    // 音声再生
    const playing =
      ref<{ speakerUuid: string; styleId: number; index: number }>();

    const audio = new Audio();
    audio.volume = 0.5;
    audio.onended = () => stop();

    const play = (
      speakerUuid: string,
      { styleId, voiceSamplePaths }: StyleInfo,
      index: number
    ) => {
      if (audio.src !== "") stop();

      audio.src = voiceSamplePaths[index];
      audio.play();
      playing.value = { speakerUuid, styleId, index };
    };
    const stop = () => {
      if (audio.src === "") return;

      audio.pause();
      audio.removeAttribute("src");
      playing.value = undefined;
    };

    // 再生していたら停止、再生していなかったら再生
    const togglePlayOrStop = (
      speakerUuid: string,
      styleInfo: StyleInfo,
      index: number
    ) => {
      if (
        playing.value === undefined ||
        speakerUuid !== playing.value.speakerUuid ||
        styleInfo.styleId !== playing.value.styleId ||
        index !== playing.value.index
      ) {
        play(speakerUuid, styleInfo, index);
      } else {
        stop();
      }
    };

    // スタイル番号をずらす
    const rollStyleIndex = (speakerUuid: string, diff: number) => {
      // 0 <= index <= length に収める
      const length = characterInfosMap.value[speakerUuid].metas.styles.length;
      const selectedStyleIndex: number | undefined =
        selectedStyleIndexes.value[speakerUuid];

      let styleIndex = (selectedStyleIndex ?? 0) + diff;
      styleIndex = styleIndex < 0 ? length - 1 : styleIndex % length;
      selectedStyleIndexes.value[speakerUuid] = styleIndex;

      // 音声を再生する。同じstyleIndexだったら停止する。
      const selectedStyleInfo =
        characterInfosMap.value[speakerUuid].metas.styles[styleIndex];
      togglePlayOrStop(speakerUuid, selectedStyleInfo, 0);
    };

    // ドラッグ中かどうか
    const characterOrderDragging = ref(false);

    const closeDialog = () => {
      store.dispatch(
        "SET_USER_CHARACTER_ORDER",
        characterOrder.value.map((info) => info.metas.speakerUuid)
      );
      stop();
      modelValueComputed.value = false;
    };

    return {
      modelValueComputed,
      characterInfosMap,
      sampleCharacterOrder,
      newCharacters,
      hasNewCharacter,
      selectedStyleIndexes,
      selectedStyles,
      selectedCharacter,
      selectCharacter,
      characterOrder,
      keyOfCharacterOrderItem,
      isHoverableItem,
      playing,
      togglePlayOrStop,
      rollStyleIndex,
      characterOrderDragging,
      closeDialog,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-toolbar div:first-child {
  min-width: 0;
}
.character-portrait-wrapper {
  display: grid;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .character-portrait {
    margin: auto;
  }
}

.main {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );

  display: flex;
  flex-direction: row;
}

.character-items-container {
  height: 100%;
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;
  overflow-y: scroll;

  > div {
    $character-item-size: 215px;
    display: grid;
    grid-template-columns: repeat(auto-fit, $character-item-size);
    grid-auto-rows: $character-item-size;
    column-gap: 10px;
    row-gap: 10px;
    align-content: center;
    justify-content: center;
    .character-item {
      box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-character-item {
        box-shadow: 0 0 0 2px colors.$primary-light;
      }
      &:hover :deep(.q-focus-helper) {
        opacity: 0 !important;
      }
      &.hoverable-character-item:hover :deep(.q-focus-helper) {
        opacity: 0.15 !important;
      }
      .character-item-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        .style-icon {
          $icon-size: $character-item-size / 2;
          width: $icon-size;
          height: $icon-size;
          border-radius: 5px;
        }
        .style-select-container {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          margin-top: -1rem;
        }
        .voice-samples {
          display: flex;
          column-gap: 5px;
          align-items: center;
          justify-content: center;
        }
        .new-character-item {
          color: colors.$primary-light;
          position: absolute;
          left: 0px;
          top: 0px;
        }
      }
    }
  }
}

.character-order-container {
  width: 180px;
  height: 100%;

  display: flex;
  flex-direction: column;

  .character-order {
    flex: 1;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;

    overflow-y: auto;

    .character-order-item {
      border-radius: 10px;
      border: 2px solid rgba(colors.$display-rgb, 0.15);
      text-align: center;
      cursor: grab;
      &.selected-character-order-item {
        border: 2px solid colors.$primary-light;
      }
    }
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

@media screen and (max-width: 880px) {
  .q-drawer-container {
    display: none;
  }
  .q-page-container {
    padding-left: unset !important;
    .q-page-sticky {
      left: 0 !important;
    }
  }
}
</style>
