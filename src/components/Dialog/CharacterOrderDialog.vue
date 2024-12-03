<template>
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
                : "設定 / キャラクター並び替え・試聴"
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

      <QDrawer
        bordered
        showIfAbove
        :modelValue="true"
        :width="$q.screen.width / 3 > 300 ? 300 : $q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="character-portrait-wrapper">
          <img :src="portrait" class="character-portrait" />
        </div>
      </QDrawer>

      <QPageContainer>
        <QPage class="main">
          <div class="character-items-container">
            <span class="text-h6 q-py-md">サンプルボイス一覧</span>
            <div>
              <CharacterTryListenCard
                v-for="characterInfo of characterInfos"
                :key="characterInfo.metas.speakerUuid"
                :characterInfo
                :isSelected="
                  selectedCharacter === characterInfo.metas.speakerUuid
                "
                :isNewCharacter="
                  newCharacters.includes(characterInfo.metas.speakerUuid)
                "
                :playing
                :togglePlayOrStop
                @update:portrait="updatePortrait"
                @update:selectCharacter="selectCharacter"
              />
            </div>
          </div>

          <div class="character-order-container">
            <div class="text-subtitle1 text-weight-bold text-center q-py-md">
              キャラクター並び替え
            </div>
            <Draggable
              v-model="characterOrder"
              class="character-order q-px-sm"
              :itemKey="keyOfCharacterOrderItem"
              @start="characterOrderDragging = true"
              @end="characterOrderDragging = false"
            >
              <template #item="{ element }">
                <div
                  class="character-order-item q-py-sm"
                  :class="[
                    selectedCharacter === element.metas.speakerUuid &&
                      'selected-character-order-item',
                  ]"
                  @mouseenter="
                    // ドラッグ中はバグるので無視
                    characterOrderDragging ||
                      selectCharacterWithChangePortrait(
                        element.metas.speakerUuid,
                      )
                  "
                >
                  {{ element.metas.speakerName }}
                </div>
              </template>
            </Draggable>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import Draggable from "vuedraggable";
import { useQuasar } from "quasar";
import CharacterTryListenCard from "./CharacterTryListenCard.vue";
import { useStore } from "@/store";
import { CharacterInfo, SpeakerId, StyleId, StyleInfo } from "@/type/preload";

const props = defineProps<{
  modelValue: boolean;
  characterInfos: CharacterInfo[];
}>();

const emit = defineEmits<{
  (event: "update:modelValue", value: boolean): void;
}>();

const $q = useQuasar();

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

// サンプルボイス一覧のキャラクター順番
const sampleCharacterOrder = ref<SpeakerId[]>([]);

// 選択中のキャラクター
const selectedCharacter = ref(props.characterInfos[0].metas.speakerUuid);
const selectCharacter = (speakerUuid: SpeakerId) => {
  selectedCharacter.value = speakerUuid;
};
const selectCharacterWithChangePortrait = (speakerUuid: SpeakerId) => {
  selectCharacter(speakerUuid);
  portrait.value = characterInfosMap.value[speakerUuid].portraitPath;
};

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

// ドラッグ中かどうか
const characterOrderDragging = ref(false);

const closeDialog = () => {
  void store.actions.SET_USER_CHARACTER_ORDER(
    characterOrder.value.map((info) => info.metas.speakerUuid),
  );
  stop();
  modelValueComputed.value = false;
};

const portrait = ref<string | undefined>(
  characterInfosMap.value[selectedCharacter.value].portraitPath,
);
const updatePortrait = (portraitPath: string) => {
  portrait.value = portraitPath;
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

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
    display: grid;
    grid-template-columns: repeat(auto-fit, vars.$character-item-size);
    grid-auto-rows: vars.$character-item-size;
    column-gap: 10px;
    row-gap: 10px;
    align-content: center;
    justify-content: center;
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
        border: 2px solid colors.$primary;
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
