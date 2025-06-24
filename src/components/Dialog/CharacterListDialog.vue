<template>
  <CharacterDetailDialog
    v-if="styleSelectDialogState.isOpen"
    :modelValue="styleSelectDialogState.isOpen"
    :characterInfo="styleSelectDialogState.characterInfo"
    @update:modelValue="onCloseStyleSelectDialog"
  />

  <QDialog
    v-model="dialogOpened"
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
                : "設定 / キャラクター＆スタイルの管理"
            }}</QToolbarTitle>
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
        <QPage>
          <div class="container">
            <!-- NOTE: styleTypeが変更されたときにスクロール領域を正しく再計算させる -->
            <BaseScrollArea :key="styleType">
              <div class="inner">
                <div class="header">
                  <span class="title">キャラクター一覧</span>
                  <div class="header-controls">
                    サンプル音声
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
            <div class="character-order-container">
              <div class="character-order-headline">キャラクター並び替え</div>
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
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Draggable from "vuedraggable";
import CharacterDetailDialog from "./CharacterDetailDialog.vue";
import CharacterTryListenCard from "./CharacterTryListenCard.vue";
import BaseToggleGroup from "@/components/Base/BaseToggleGroup.vue";
import BaseToggleGroupItem from "@/components/Base/BaseToggleGroupItem.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
import { useStore } from "@/store";
import { CharacterInfo, SpeakerId, StyleId, StyleInfo } from "@/type/preload";
import { filterCharacterInfosByStyleType } from "@/store/utility";
import { debounce } from "@/helpers/timer";

const dialogOpened = defineModel<boolean>("dialogOpened", { default: false });
const props = defineProps<{
  characterInfos: CharacterInfo[];
}>();

const store = useStore();

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

const styleType = ref<"talk" | "singerLike">("talk");

// サンプルボイス一覧のキャラクター順番
const sampleCharacterOrder = ref<SpeakerId[]>([]);

// 選択中のキャラクター
const styleSelectDialogState = ref<
  { isOpen: true; characterInfo: CharacterInfo } | { isOpen: false }
>({
  isOpen: false,
});
const selectCharacter = (speakerUuid: SpeakerId) => {
  const characterInfo = props.characterInfos.find(
    (characterInfo) => characterInfo.metas.speakerUuid == speakerUuid,
  );
  if (characterInfo == undefined)
    throw new Error(`キャラクターが見つかりません: ${speakerUuid}`);
  styleSelectDialogState.value = { isOpen: true, characterInfo };
};

const onCloseStyleSelectDialog = () => {
  styleSelectDialogState.value = { isOpen: false };
};

// キャラクター表示順序
const characterOrder = ref<CharacterInfo[]>([]);

// ダイアログが開かれたときに初期値を求める
watch(dialogOpened, async (newValue, oldValue) => {
  if (!oldValue && newValue) {
    // 新しいキャラクター
    newCharacters.value = await store.actions.GET_NEW_CHARACTERS();

    // サンプルの順番、新しいキャラクターは上に
    sampleCharacterOrder.value = [
      ...newCharacters.value,
      ...props.characterInfos
        .filter((info) => !newCharacters.value.includes(info.metas.speakerUuid))
        .map((info) => info.metas.speakerUuid),
    ];

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

    // 新しいキャラクターがいる場合は認識済みにする
    if (hasNewCharacter.value) {
      acknowledgeNewCharacters();
    }
  }
});

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

function acknowledgeNewCharacters() {
  // NOTE: 新しいキャラクターが存在するかはUSER_CHARACTER_ORDERで判定しているので、USER_CHARACTER_ORDERを更新する
  // ref: https://github.com/VOICEVOX/voicevox/pull/2505#discussion_r2055218127
  // FIXME: 新しいキャラクターをチェックしたかの判定をUSER_CHARACTER_ORDERで行わないようにする
  saveCharacterOrder(characterOrder.value);
}

const closeDialog = () => {
  stop();
  dialogOpened.value = false;
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
  display: grid;
  grid-template-columns: 1fr auto;
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
  gap: vars.$gap-2;
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
  display: flex;
  flex-direction: column;
  background-color: colors.$background;
  border-left: 1px solid colors.$border;
}

.character-order-headline {
  @include mixin.headline-3;
  padding: vars.$padding-2;
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
