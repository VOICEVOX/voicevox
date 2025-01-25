<template>
  <DefaultStyleSelectDialog
    v-if="selectedCharacterInfo"
    v-model:isOpen="showStyleSelectDialog"
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
            <QToolbarTitle class="text-display">{{
              hasNewCharacter
                ? "追加キャラクターの紹介"
                : "設定 / キャラクターの管理"
            }}</QToolbarTitle>
          </div>

          <QSpace />

          <div class="row items-center no-wrap">
            <BaseTooltip
              label="トーク画面でのスタイル選択の並び順を編集できます。"
            >
              <QBtn
                unelevated
                color="toolbar-button"
                textColor="toolbar-button-display"
                class="text-no-wrap text-bold q-mr-sm"
                icon="sort"
                @click="showOrderPane = !showOrderPane"
                >並び順を編集</QBtn
              >
            </BaseTooltip>
            <QBtn
              round
              flat
              icon="close"
              color="display"
              @click="closeDialog"
            />
          </div>
        </QToolbar>
      </QHeader>

      <QPageContainer>
        <QPage>
          <div class="container">
            <!-- スクロールバー再計算のため、keyにstyleTypeを設定 -->
            <BaseScrollArea :key="styleType">
              <div class="inner">
                <div class="header">
                  <span class="title">キャラクター一覧</span>
                  <div class="header-controls">
                    <BaseToggleGroup v-model="styleType" type="single">
                      <BaseToggleGroupItem label="トーク" value="talk" />
                      <BaseToggleGroupItem label="ソング" value="singerLike" />
                    </BaseToggleGroup>
                  </div>
                </div>
                <div class="character-items-container">
                  <template
                    v-for="characterInfo of filterCharacterInfosByStyleType(
                      characterInfos,
                      styleType,
                    )"
                    :key="characterInfo.metas.speakerUuid"
                  >
                    <CharacterTryListenCard
                      v-if="characterInfo.metas.styles.length > 0"
                      :characterInfo
                      :isNewCharacter="
                        newCharacters.includes(characterInfo.metas.speakerUuid)
                      "
                      :playing
                      :togglePlayOrStop
                      @selectCharacter="selectCharacter"
                    />
                  </template>
                </div>
              </div>
            </BaseScrollArea>
          </div>
          <div v-if="showOrderPane" class="character-order-overlay"></div>
          <div v-if="showOrderPane" class="character-order-container">
            <div class="character-order-headline">
              キャラクター並び替え
              <BaseIconButton
                label="閉じる"
                icon="close"
                @click="showOrderPane = false"
              />
            </div>
            <BaseScrollArea>
              <Draggable
                v-model="characterOrder"
                class="character-order"
                :itemKey="keyOfCharacterOrderItem"
                @end="saveCharacterOrder(characterOrder)"
              >
                <template #item="{ element }">
                  <div class="character-order-item">
                    {{ element.metas.speakerName }}
                  </div>
                </template>
              </Draggable>
            </BaseScrollArea>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Draggable from "vuedraggable";
import DefaultStyleSelectDialog from "./DefaultStyleSelectDialog.vue";
import CharacterTryListenCard from "./CharacterTryListenCard.vue";
import BaseToggleGroup from "@/components/Base/BaseToggleGroup.vue";
import BaseToggleGroupItem from "@/components/Base/BaseToggleGroupItem.vue";
import BaseIconButton from "@/components/Base/BaseIconButton.vue";
import BaseTooltip from "@/components/Base/BaseTooltip.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import { useStore } from "@/store";
import { CharacterInfo, SpeakerId, StyleId, StyleInfo } from "@/type/preload";
import { filterCharacterInfosByStyleType } from "@/store/utility";
import { debounce } from "@/helpers/timer";

const props = defineProps<{
  modelValue: boolean;
  characterInfos: CharacterInfo[];
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
}>();

const store = useStore();

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const characterInfosMap = computed(() => {
  const map: { [key: SpeakerId]: CharacterInfo } = {};
  props.characterInfos.forEach((characterInfo) => {
    map[characterInfo.metas.speakerUuid] = characterInfo;
  });
  return map;
});

// 新しいキャラクター
const newCharacters = ref<SpeakerId[]>([]);
const hasNewCharacter = computed(() => newCharacters.value.length > 0);

const showStyleSelectDialog = ref<boolean>(false);
const showOrderPane = ref<boolean>(false);

const styleType = ref<"talk" | "singerLike">("talk");

// サンプルボイス一覧のキャラクター順番
const sampleCharacterOrder = ref<SpeakerId[]>([]);

// 選択中のキャラクター
const selectedCharacter = ref(props.characterInfos[0].metas.speakerUuid);
const selectCharacter = (speakerUuid: SpeakerId) => {
  selectedCharacter.value = speakerUuid;
  showStyleSelectDialog.value = true;
};

const selectedCharacterInfo = computed(() => {
  return props.characterInfos.find(
    (characterInfo) =>
      characterInfo.metas.speakerUuid === selectedCharacter.value,
  );
});

// キャラクター表示順序
const characterOrder = ref<CharacterInfo[]>([]);

// ダイアログが開かれたときに初期値を求める
watch(
  () => props.modelValue,
  async (newValue, oldValue) => {
    if (!oldValue && newValue) {
      // 新しいキャラクター
      newCharacters.value = await store.actions.GET_NEW_CHARACTERS();

      // サンプルの順番、新しいキャラクターは上に
      sampleCharacterOrder.value = [
        ...newCharacters.value,
        ...props.characterInfos
          .filter(
            (info) => !newCharacters.value.includes(info.metas.speakerUuid),
          )
          .map((info) => info.metas.speakerUuid),
      ];

      selectedCharacter.value = sampleCharacterOrder.value[0];

      // 保存済みのキャラクターリストを取得
      // FIXME: 不明なキャラを無視しているので、不明キャラの順番が保存時にリセットされてしまう
      characterOrder.value = store.state.userCharacterOrder
        .map((speakerUuid) => characterInfosMap.value[speakerUuid])
        .filter((info) => info != undefined);

      // 含まれていないキャラクターを足す
      const notIncludesCharacterInfos = props.characterInfos.filter(
        (characterInfo) =>
          !characterOrder.value.find(
            (characterInfoInList) =>
              characterInfoInList.metas.speakerUuid ===
              characterInfo.metas.speakerUuid,
          ),
      );
      characterOrder.value = [
        ...characterOrder.value,
        ...notIncludesCharacterInfos,
      ];
    }
  },
);

// draggable用
const keyOfCharacterOrderItem = (item: CharacterInfo) => item.metas.speakerUuid;

// 音声再生
const playing = ref<{
  speakerUuid: SpeakerId;
  styleId: StyleId;
  index: number;
}>();

const audio = new Audio();
audio.volume = 0.5;
audio.onended = () => stop();

const play = (
  speakerUuid: SpeakerId,
  { styleId, voiceSamplePaths }: StyleInfo,
  index: number,
) => {
  if (audio.src !== "") stop();

  audio.src = voiceSamplePaths[index];
  void audio.play();
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
  speakerUuid: SpeakerId,
  styleInfo: StyleInfo,
  index: number,
) => {
  if (
    playing.value == undefined ||
    speakerUuid !== playing.value.speakerUuid ||
    styleInfo.styleId !== playing.value.styleId ||
    index !== playing.value.index
  ) {
    play(speakerUuid, styleInfo, index);
  } else {
    stop();
  }
};

const saveCharacterOrder = debounce((characterInfos: CharacterInfo[]) => {
  void store.actions.SET_USER_CHARACTER_ORDER(
    characterInfos.map((info) => info.metas.speakerUuid),
  );
}, 300);

const closeDialog = () => {
  stop();
  styleType.value = "talk";
  showOrderPane.value = false;
  modelValueComputed.value = false;
};
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/colors" as colors;
@use "@/styles/v2/mixin" as mixin;

.q-toolbar div:first-child {
  min-width: 0;
}

.container {
  // TODO: 親コンポーネントからheightを取得できないため一時的にcalcを使用、Dialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
  background-color: colors.$background;
}

.inner {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: vars.$gap-1;
  padding: vars.$padding-2;
}

.character-items-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: vars.$gap-1;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: vars.$gap-1;
  width: 100%;
}

.title {
  @include mixin.headline-1;
}

.header-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: vars.$gap-1;
}

.character-order-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba($color: #000000, $alpha: 0.4);
}

.character-order-container {
  // TODO: 親コンポーネントからheightを取得できないため一時的にcalcを使用、HelpDialogの構造を再設計後100%に変更する
  // height: 100%;
  height: calc(100vh - 90px);
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  background-color: colors.$background;
  border-left: 1px solid colors.$border;
  z-index: vars.$z-index-fixed;
}

.character-order-headline {
  display: flex;
  align-items: center;
  padding: vars.$padding-2;
  gap: vars.$gap-1;
}

.character-order {
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  padding-top: 0;
  gap: vars.$gap-1;

  .character-order-item {
    border-radius: vars.$radius-1;
    padding: vars.$padding-1;
    border: 1px solid colors.$border;
    background-color: colors.$surface;
    text-align: center;
    cursor: grab;

    &[draggable="true"] {
      border: 2px solid colors.$primary;
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
