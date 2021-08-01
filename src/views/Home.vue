<template>
  <div v-if="!isEngineReady" class="waiting-engine">
    <div>
      <mcw-circular-progress indeterminate></mcw-circular-progress>
      <div>エンジン起動中・・・</div>
    </div>
  </div>
  <mcw-top-app-bar>
    <div class="mdc-top-app-bar__row">
      <section
        class="mdc-top-app-bar__section mdc-top-app-bar__section--align-start"
      >
        <mcw-button @click="playContinuously" :disabled="uiLocked" unelevated
          >連続再生</mcw-button
        >
        <mcw-button
          @click="stopContinuously"
          :disabled="!nowPlayingContinuously"
          unelevated
          >停止</mcw-button
        >
        <mcw-button
          @click="generateAndSaveAllAudio"
          :disabled="uiLocked"
          unelevated
          >書き出し</mcw-button
        >
      </section>

      <section
        class="mdc-top-app-bar__section mdc-top-app-bar__section--align-end"
      >
        <!-- 
        <mcw-button @click="undo" :disabled="!canUndo || uiLocked" unelevated
          >元に戻す</mcw-button
        >
        <mcw-button @click="redo" :disabled="!canRedo || uiLocked" unelevated
          >やり直す</mcw-button
        > -->
        <mcw-button @click="createHelpWindow" :disabled="uiLocked" unelevated
          >ヘルプ</mcw-button
        >
      </section>
    </div>
  </mcw-top-app-bar>
  <div class="mdc-top-app-bar--fixed-adjust relarive-absolute-wrapper">
    <div>
      <div class="main-row-panes">
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
            <mcw-fab
              v-if="!uiLocked"
              icon="add"
              @click="addAudioItem"
            ></mcw-fab>
          </div>
        </div>
        <audio-info-pane-separator />
        <audio-info
          id="audio-info-pane"
          :style="{
            width:
              audioInfoPaneWidth !== undefined
                ? `${audioInfoPaneWidth}px`
                : '100px',
          }"
        />
      </div>
      <audio-detail-pane-separator />
      <audio-detail
        id="audio-detail-pane"
        :style="{
          height:
            audioDetailPaneHeight !== undefined
              ? `${audioDetailPaneHeight}px`
              : '100px',
        }"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUpdate, onMounted } from "vue";
import { useStore } from "@/store";
import AudioCell from "@/components/AudioCell.vue";
import AudioDetail from "@/components/AudioDetail.vue";
import AudioDetailPaneSeparator from "@/components/AudioDetailPaneSeparator.vue";
import AudioInfo from "@/components/AudioInfo.vue";
import AudioInfoPaneSeparator from "@/components/AudioInfoPaneSeparator.vue";
import { CAN_REDO, CAN_UNDO, REDO, UNDO } from "@/store/command";
import { AudioItem } from "@/store/type";
import {
  ACTIVE_AUDIO_KEY,
  GENERATE_AND_SAVE_ALL_AUDIO,
  LOAD_CHARACTOR,
  PLAY_CONTINUOUSLY_AUDIO,
  REGISTER_AUDIO_ITEM,
  START_WAITING_ENGINE,
  STOP_CONTINUOUSLY_AUDIO,
} from "@/store/audio";
import { UI_LOCKED } from "@/store/ui";
import { CREATE_HELP_WINDOW } from "@/electron/ipc";

export default defineComponent({
  name: "Home",

  components: {
    AudioCell,
    AudioDetail,
    AudioDetailPaneSeparator,
    AudioInfo,
    AudioInfoPaneSeparator,
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

    // view
    const audioInfoPaneWidth = computed(() => {
      return store.state.audioInfoPaneOffset !== undefined
        ? document.body.clientWidth - store.state.audioInfoPaneOffset
        : undefined;
    });
    const audioDetailPaneHeight = computed(() => {
      return store.state.audioDetailPaneOffset !== undefined
        ? document.body.clientHeight - store.state.audioDetailPaneOffset
        : undefined;
    });

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
      playContinuously,
      stopContinuously,
      generateAndSaveAllAudio,
      audioInfoPaneWidth,
      audioDetailPaneHeight,
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
@use '@/styles' as global;

@use '@material/theme' with (
  $primary: global.$primary,
  $on-primary: #212121,
);

@use '@material/button';
@use "@material/fab";
@use "@material/top-app-bar/mdc-top-app-bar";

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

.mdc-top-app-bar__section--align-start,
.mdc-top-app-bar__section--align-end {
  button {
    @include button.filled-accessible(white);

    @extend .mdc-top-app-bar__action-item;
    font-weight: bold;
    margin-right: 0.5rem;
  }
}

.mdc-top-app-bar {
  position: static !important;
}

.mdc-top-app-bar--fixed-adjust {
  flex-grow: 1;
  padding-top: 0 !important;
  > div {
    display: flex;
    flex-direction: column;
  }
}

.main-row-panes {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0;

  display: flex;
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

    .mdc-fab {
      @include fab.accessible(global.$primary);
    }
  }
}

#audio-info-pane {
  max-width: 250px;
  min-width: 130px;
}

#audio-detail-pane {
  max-height: 500px;
  min-height: 170px;
}
</style>
