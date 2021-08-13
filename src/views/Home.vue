<template>
  <div v-if="!isEngineReady" class="waiting-engine">
    <div>
      <q-spinner color="primary" size="2.5rem" />
      <div>エンジン起動中・・・</div>
    </div>
  </div>
  <q-layout reveal elevated>
    <q-header class="q-py-sm">
      <q-toolbar>
        <q-btn
          unelevated
          color="white"
          text-color="secondary"
          class="text-no-wrap text-bold q-mr-sm"
          :disable="uiLocked"
          @click="playContinuously"
          >連続再生</q-btn
        >
        <q-btn
          unelevated
          color="white"
          text-color="secondary"
          class="text-no-wrap text-bold q-mr-sm"
          :disable="!nowPlayingContinuously"
          @click="stopContinuously"
          >停止</q-btn
        >

        <q-space />

        <!-- <q-btn
          unelevated
          color="white"
          text-color="secondary"
          class="text-no-wrap text-bold q-mr-sm"
          :disable="!canUndo || uiLocked"
          @click="undo"
          >元に戻す</q-btn
        >
        <q-btn
          unelevated
          color="white"
          text-color="secondary"
          class="text-no-wrap text-bold q-mr-sm"
          :disable="!canRedo || uiLocked"
          @click="redo"
          >やり直す</q-btn
        > -->
        <q-btn
          unelevated
          color="white"
          text-color="secondary"
          class="text-no-wrap text-bold"
          :disable="uiLocked"
          @click="createHelpWindow"
          >ヘルプ</q-btn
        >
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="main-row-panes">
        <q-splitter
          horizontal
          reverse
          unit="px"
          :limits="[audioDetailPaneMinHeight, audioDetailPaneMaxHeight]"
          separator-class="bg-primary"
          separator-style="height: 3px"
          class="full-width"
          before-class="overflow-hidden"
          v-model="audioDetailPaneHeight"
        >
          <template #before>
            <q-splitter
              reverse
              unit="px"
              :limits="[audioInfoPaneMinWidth, audioInfoPaneMaxWidth]"
              separator-class="bg-primary"
              separator-style="width: 3px"
              class="full-width"
              v-model="audioInfoPaneWidth"
            >
              <template #before>
                <div id="audio-cell-pane">
                  <div class="audio-cells">
                    <audio-cell
                      v-for="audioKey in audioKeys"
                      :key="audioKey"
                      :audioKey="audioKey"
                      @focusCell="focusCell"
                      :ref="addAudioCellRef"
                    />
                  </div>
                  <div class="add-button-wrapper">
                    <q-btn
                      fab
                      icon="add"
                      color="primary"
                      text-color="secondary"
                      :disable="uiLocked"
                      @click="addAudioItem"
                    ></q-btn>
                  </div>
                </div>
              </template>
              <template #after>
                <audio-info id="audio-info-pane" />
              </template>
            </q-splitter>
          </template>
          <template #after>
            <audio-detail id="audio-detail-pane" />
          </template>
        </q-splitter>

        <q-resize-observer ref="resizeObserverRef" @resize="pageOnResize" />
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script lang="ts">
import {
  computed,
  defineComponent,
  onBeforeUpdate,
  onMounted,
  ref,
  watch,
} from "vue";
import { useStore, SAVE_PROJECT_FILE, LOAD_PROJECT_FILE } from "@/store";
import AudioCell from "@/components/AudioCell.vue";
import AudioDetail from "@/components/AudioDetail.vue";
import AudioInfo from "@/components/AudioInfo.vue";
import { CAN_REDO, CAN_UNDO, REDO, UNDO } from "@/store/command";
import { AudioItem } from "@/store/type";
import {
  ACTIVE_AUDIO_KEY,
  GENERATE_AND_SAVE_ALL_AUDIO,
  IMPORT_FROM_FILE,
  LOAD_CHARACTOR,
  PLAY_CONTINUOUSLY_AUDIO,
  REGISTER_AUDIO_ITEM,
  START_WAITING_ENGINE,
  STOP_CONTINUOUSLY_AUDIO,
} from "@/store/audio";
import { UI_LOCKED, CREATE_HELP_WINDOW } from "@/store/ui";
import Mousetrap from "mousetrap";
import { QResizeObserver } from "quasar";

export default defineComponent({
  name: "Home",

  components: {
    AudioCell,
    AudioDetail,
    AudioInfo,
  },

  setup() {
    const store = useStore();
    const audioItems = computed(() => store.state.audioItems);
    const audioKeys = computed(() => store.state.audioKeys);
    const nowPlayingContinuously = computed(
      () => store.state.nowPlayingContinuously
    );

    const uiLocked = computed(() => store.getters[UI_LOCKED]);
    const canUndo = computed(() => store.getters[CAN_UNDO]);
    const canRedo = computed(() => store.getters[CAN_REDO]);

    // add hotkeys
    Mousetrap.bind(["ctrl+e"], () => {
      generateAndSaveAllAudio();
    });

    Mousetrap.bind("shift+enter", () => {
      addAudioItem();
    });

    const undo = () => {
      store.dispatch(UNDO);
    };
    const redo = () => {
      store.dispatch(REDO);
    };
    const playContinuously = () => {
      store.dispatch(PLAY_CONTINUOUSLY_AUDIO, {});
    };
    const stopContinuously = () => {
      store.dispatch(STOP_CONTINUOUSLY_AUDIO, {});
    };
    const generateAndSaveAllAudio = () => {
      store.dispatch(GENERATE_AND_SAVE_ALL_AUDIO, {});
    };
    const saveProjectFile = () => {
      store.dispatch(SAVE_PROJECT_FILE, {});
    };
    const loadProjectFile = () => {
      store.dispatch(LOAD_PROJECT_FILE, {});
    };
    const importFromFile = () => {
      store.dispatch(IMPORT_FROM_FILE, {});
    };

    // view
    const MIN_AUDIO_INFO_PANE_WIDTH = 130;
    const MAX_AUDIO_INFO_PANE_WIDTH = 250;
    const MIN_AUDIO_DETAIL_PANE_HEIGHT = 170;
    const MAX_AUDIO_DETAIL_PANE_HEIGHT = 500;

    const audioInfoPaneWidth = ref(0);
    const audioInfoPaneMinWidth = ref(0);
    const audioInfoPaneMaxWidth = ref(0);
    const audioDetailPaneHeight = ref(0);
    const audioDetailPaneMinHeight = ref(0);
    const audioDetailPaneMaxHeight = ref(0);

    const pageOnResize = ({ height }: { height: number }) => {
      if (!activeAudioKey.value) return;

      const maxHeight = height - 200;
      if (maxHeight > MAX_AUDIO_DETAIL_PANE_HEIGHT) {
        // 最大値以上なら最大値に設定
        audioDetailPaneMaxHeight.value = MAX_AUDIO_DETAIL_PANE_HEIGHT;
      } else if (height < 200 + MIN_AUDIO_DETAIL_PANE_HEIGHT) {
        // 最低値以下になってしまう場合は無制限に
        audioDetailPaneMaxHeight.value = Infinity;
      } else {
        audioDetailPaneMaxHeight.value = maxHeight;
      }
    };

    // component
    let audioCellRefs: Record<string, typeof AudioCell> = {};
    const addAudioCellRef = (audioCellRef: typeof AudioCell) => {
      if (audioCellRef) {
        audioCellRefs[audioCellRef.audioKey] = audioCellRef;
      }
    };
    onBeforeUpdate(() => {
      audioCellRefs = {};
    });

    const resizeObserverRef = ref<QResizeObserver>();

    // セルを追加
    const activeAudioKey = computed<string | undefined>(
      () => store.getters[ACTIVE_AUDIO_KEY]
    );
    const addAudioItem = async () => {
      const audioItem: AudioItem = { text: "", charactorIndex: 0 };
      const newAudioKey = await store.dispatch(REGISTER_AUDIO_ITEM, {
        audioItem,
        prevAudioKey: activeAudioKey.value,
      });
      audioCellRefs[newAudioKey].focusTextField();
    };

    watch(activeAudioKey, (val, old) => {
      if (!!val === !!old) return;

      if (val) {
        audioInfoPaneWidth.value = MIN_AUDIO_INFO_PANE_WIDTH;
        audioInfoPaneMinWidth.value = MIN_AUDIO_INFO_PANE_WIDTH;
        audioInfoPaneMaxWidth.value = MAX_AUDIO_INFO_PANE_WIDTH;
        audioDetailPaneHeight.value = MIN_AUDIO_DETAIL_PANE_HEIGHT;
        audioDetailPaneMinHeight.value = MIN_AUDIO_DETAIL_PANE_HEIGHT;
        pageOnResize({
          height: resizeObserverRef.value?.$el.parentElement.clientHeight,
        });
      } else {
        audioInfoPaneWidth.value = 0;
        audioInfoPaneMinWidth.value = 0;
        audioInfoPaneMaxWidth.value = 0;
        audioDetailPaneHeight.value = 0;
        audioDetailPaneMinHeight.value = 0;
        audioDetailPaneMaxHeight.value = 0;
      }
    });

    // セルを追加して移動
    const addAndMoveCell = async ({
      prevAudioKey,
    }: {
      prevAudioKey: string;
    }) => {
      const audioItem: AudioItem = {
        text: "",
        charactorIndex: audioItems.value[prevAudioKey].charactorIndex,
      };
      const newAudioKey = await store.dispatch(REGISTER_AUDIO_ITEM, {
        audioItem,
        prevAudioKey,
      });
      audioCellRefs[newAudioKey].focusTextField();
    };

    // セルをフォーカス
    const focusCell = ({ audioKey }: { audioKey: string }) => {
      audioCellRefs[audioKey].focusTextField();
    };

    // プロジェクトを初期化
    onMounted(async () => {
      await store.dispatch(LOAD_CHARACTOR);
      addAudioItem();
    });

    // エンジン待機
    const isEngineReady = computed(() => store.state.isEngineReady);
    store.dispatch(START_WAITING_ENGINE);

    // ライセンス表示
    const createHelpWindow = () => {
      store.dispatch(CREATE_HELP_WINDOW);
    };

    return {
      audioItems,
      audioKeys,
      nowPlayingContinuously,
      uiLocked,
      canUndo,
      canRedo,
      undo,
      redo,
      addAudioCellRef,
      addAudioItem,
      addAndMoveCell,
      focusCell,
      pageOnResize,
      resizeObserverRef,
      playContinuously,
      stopContinuously,
      generateAndSaveAllAudio,
      saveProjectFile,
      loadProjectFile,
      importFromFile,
      audioInfoPaneWidth,
      audioInfoPaneMinWidth,
      audioInfoPaneMaxWidth,
      audioDetailPaneHeight,
      audioDetailPaneMinHeight,
      audioDetailPaneMaxHeight,
      isEngineReady,
      createHelpWindow,
    };
  },
});
</script>

<style lang="scss">
body {
  user-select: none;
}

.relarive-absolute-wrapper {
  position: relative;
  > div {
    position: absolute;
    inset: 0;
  }
}
</style>

<style lang="scss">
.waiting-engine {
  background-color: #0002;
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    background: white;
    border-radius: 6px;
    padding: 14px;
  }
}

.main-row-panes {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0;

  display: flex;

  .q-splitter--horizontal {
    height: calc(100vh - 66px);
  }
}

#audio-cell-pane {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0;

  position: relative;
  height: 100%;

  .audio-cells {
    overflow-x: hidden;
    overflow-y: scroll;

    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
  }
  .add-button-wrapper {
    position: absolute;
    right: 0px;
    bottom: 0px;

    margin-right: 26px;
    margin-bottom: 10px;
  }
}
</style>
