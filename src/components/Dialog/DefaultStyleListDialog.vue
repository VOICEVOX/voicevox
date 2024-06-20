<template>
  <DefaultStyleSelectDialog
    v-if="
      selectedCharacterInfo &&
      selectedStyleIndexes[selectedCharacterInfo.metas.speakerUuid] !==
        undefined
    "
    v-model:isOpen="showStyleSelectDialog"
    v-model:selectedStyleIndex="
      selectedStyleIndexes[selectedCharacterInfo.metas.speakerUuid]
    "
    :characterInfo="selectedCharacterInfo"
  />
  <QDialog
    v-model="modelValueComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="transparent-backdrop"
  >
    <QLayout container view="hHh Lpr lff" class="bg-background">
      <QHeader class="q-py-sm">
        <QToolbar>
          <div class="column">
            <QToolbarTitle class="text-display"
              >設定 / デフォルトスタイル・試聴</QToolbarTitle
            >
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <QBtn
              unelevated
              label="完了"
              color="toolbar-button"
              textColor="toolbar-button-display"
              class="text-no-wrap"
              @click="closeDialog"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage class="main">
          <div class="character-items-container">
            <div>
              <QItem
                v-for="speaker of speakerWithMultipleStyles"
                :key="speaker.metas.speakerUuid"
                v-ripple="isHoverableItem"
                clickable
                class="q-pa-none character-item"
                :class="[isHoverableItem && 'hoverable-character-item']"
                @click="openStyleSelectDialog(speaker)"
              >
                <div class="character-item-inner">
                  <img
                    :src="
                      speaker.metas.styles[
                        selectedStyleIndexes[speaker.metas.speakerUuid]
                      ].iconPath
                    "
                    class="style-icon"
                  />
                  <span
                    class="text-subtitle1 q-mt-sm q-mb-xs text-weight-bold"
                    >{{
                      characterInfosMap[speaker.metas.speakerUuid].metas
                        .speakerName
                    }}</span
                  >
                  <div
                    v-if="
                      characterInfosMap[speaker.metas.speakerUuid].metas.styles
                        .length > 1
                    "
                    class="style-select-container"
                  >
                    <span>{{
                      selectedStyles[speaker.metas.speakerUuid]
                        ? selectedStyles[speaker.metas.speakerUuid].styleName
                        : DEFAULT_STYLE_NAME
                    }}</span
                    ><span class="text-caption"
                      >全{{
                        characterInfosMap[speaker.metas.speakerUuid].metas
                          .styles.length
                      }}スタイル</span
                    >
                  </div>
                </div>
              </QItem>
            </div>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DefaultStyleSelectDialog from "./DefaultStyleSelectDialog.vue";
import { useStore } from "@/store";
import { DEFAULT_STYLE_NAME } from "@/store/utility";
import { CharacterInfo, SpeakerId, StyleInfo } from "@/type/preload";
const props = defineProps<{
  modelValue: boolean;
  characterInfos: CharacterInfo[];
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

// 選択中のキャラクター
const selectedCharacter = ref(props.characterInfos[0].metas.speakerUuid);

const showStyleSelectDialog = ref<boolean>(false);
const selectedCharacterInfo = computed(() => {
  return props.characterInfos.find(
    (characterInfo) =>
      characterInfo.metas.speakerUuid === selectedCharacter.value,
  );
});

const characterInfosMap = computed(() => {
  const map: { [key: SpeakerId]: CharacterInfo } = {};
  props.characterInfos.forEach((characterInfo) => {
    map[characterInfo.metas.speakerUuid] = characterInfo;
  });
  return map;
});

// サンプルボイス一覧のキャラクター順番
const speakerWithMultipleStyles = ref<CharacterInfo[]>([]);

// 選択中のスタイル
const selectedStyleIndexes = ref<Record<SpeakerId, number>>({});
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

// ダイアログが開かれたときに初期値を求める
watch([() => props.modelValue], async ([newValue]) => {
  if (newValue) {
    speakerWithMultipleStyles.value = store.state.userCharacterOrder
      .map((speakerUuid) => characterInfosMap.value[speakerUuid])
      .filter((characterInfo) => characterInfo != undefined)
      .filter(
        (characterInfo) => characterInfo.metas.styles.length > 1,
      ) as CharacterInfo[];
    // FIXME: エンジン未起動状態でデフォルトスタイル選択ダイアログを開くと
    // 未起動エンジンのキャラのデフォルトスタイルが消えてしまう
    selectedStyleIndexes.value = Object.fromEntries(
      [
        ...store.state.userCharacterOrder.map(
          (speakerUuid) => [speakerUuid, 0] as const,
        ),
        ...store.state.defaultStyleIds.map(
          (defaultStyle) =>
            [
              defaultStyle.speakerUuid,
              characterInfosMap.value[
                defaultStyle.speakerUuid
              ]?.metas.styles.findIndex(
                (style) => style.styleId === defaultStyle.defaultStyleId,
              ),
            ] as const,
        ),
      ].filter(([speakerUuid]) => speakerUuid in characterInfosMap.value),
    );
  }
});

// キャラクター枠のホバー状態を表示するかどうか
// 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
const isHoverableItem = ref(true);

const closeDialog = () => {
  store.dispatch(
    "SET_DEFAULT_STYLE_IDS",
    Object.entries(selectedStyleIndexes.value).map(
      ([speakerUuidStr, styleIndex]) => {
        const speakerUuid = SpeakerId(speakerUuidStr);
        return {
          speakerUuid,
          defaultStyleId:
            characterInfosMap.value[speakerUuid].metas.styles[styleIndex]
              .styleId,
          engineId:
            characterInfosMap.value[speakerUuid].metas.styles[styleIndex]
              .engineId,
        };
      },
    ),
  );
  stop();
  modelValueComputed.value = false;
};
const openStyleSelectDialog = (characterInfo: CharacterInfo) => {
  stop();
  selectedCharacter.value = characterInfo.metas.speakerUuid;
  showStyleSelectDialog.value = true;
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.q-toolbar div:first-child {
  min-width: 0;
}

.main {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
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
    $character-item-size: 200px;
    display: grid;
    grid-template-columns: repeat(auto-fit, $character-item-size);
    grid-auto-rows: 200px;
    column-gap: 10px;
    row-gap: 10px;
    align-content: center;
    justify-content: center;
    .character-item {
      box-shadow: 0 0 0 1px rgba(colors.$primary-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-character-item {
        box-shadow: 0 0 0 2px colors.$primary;
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
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }
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
</style>
