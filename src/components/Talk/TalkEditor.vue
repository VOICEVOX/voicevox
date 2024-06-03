<template>
  <QLayout reveal elevated container class="layout-container">
    <ToolBar />

    <QPageContainer>
      <QPage class="main-row-panes">
        <ProgressView />
        <EngineStartupOverlay :isCompletedInitialStartup />

        <QSplitter
          horizontal
          reverse
          unit="px"
          :limits="[audioDetailPaneMinHeight, audioDetailPaneMaxHeight]"
          separatorClass="home-splitter"
          :separatorStyle="{ height: shouldShowPanes ? '3px' : '0' }"
          class="full-width"
          beforeClass="overflow-hidden"
          :disable="!shouldShowPanes"
          :modelValue="audioDetailPaneHeight"
          @update:modelValue="updateAudioDetailPane"
        >
          <template #before>
            <QSplitter
              :limits="[MIN_PORTRAIT_PANE_WIDTH, MAX_PORTRAIT_PANE_WIDTH]"
              separatorClass="home-splitter"
              :separatorStyle="{ width: shouldShowPanes ? '3px' : '0' }"
              beforeClass="overflow-hidden"
              :disable="!shouldShowPanes"
              :modelValue="portraitPaneWidth"
              @update:modelValue="updatePortraitPane"
            >
              <template #before>
                <CharacterPortrait />
              </template>
              <template #after>
                <QSplitter
                  reverse
                  unit="px"
                  :limits="[audioInfoPaneMinWidth, audioInfoPaneMaxWidth]"
                  separatorClass="home-splitter"
                  :separatorStyle="{ width: shouldShowPanes ? '3px' : '0' }"
                  class="full-width overflow-hidden"
                  :disable="!shouldShowPanes"
                  :modelValue="audioInfoPaneWidth"
                  @update:modelValue="updateAudioInfoPane"
                >
                  <template #before>
                    <div
                      class="audio-cell-pane"
                      :class="{ 'is-dragging': dragEventCounter > 0 }"
                      @dragenter="dragEventCounter++"
                      @dragleave="dragEventCounter--"
                      @dragover.prevent
                      @drop.prevent="
                        dragEventCounter = 0;
                        loadDraggedFile($event);
                      "
                      @click="onAudioCellPaneClick"
                    >
                      <Draggable
                        ref="cellsRef"
                        class="audio-cells"
                        :modelValue="audioKeys"
                        :itemKey
                        ghostClass="ghost"
                        filter="input"
                        :preventOnFilter="false"
                        @update:modelValue="updateAudioKeys"
                      >
                        <template #item="{ element }">
                          <AudioCell
                            :ref="addAudioCellRef"
                            class="draggable-cursor"
                            :audioKey="element"
                            @focusCell="focusCell"
                          />
                        </template>
                      </Draggable>
                      <div
                        v-if="showAddAudioItemButton"
                        class="add-button-wrapper"
                      >
                        <QBtn
                          fab
                          icon="add"
                          color="primary"
                          textColor="display-on-primary"
                          :disable="uiLocked"
                          aria-label="テキストを追加"
                          @click="addAudioItem"
                        ></QBtn>
                      </div>
                    </div>
                  </template>
                  <template #after>
                    <AudioInfo
                      v-if="activeAudioKey != undefined"
                      :activeAudioKey
                    />
                  </template>
                </QSplitter>
              </template>
            </QSplitter>
          </template>
          <template #after>
            <AudioDetail v-if="activeAudioKey != undefined" :activeAudioKey />
          </template>
        </QSplitter>

        <QResizeObserver
          ref="resizeObserverRef"
          @resize="({ height }) => changeAudioDetailPaneMaxHeight(height)"
        />
      </QPage>
    </QPageContainer>
  </QLayout>
</template>

<script setup lang="ts">
import path from "path";
import { computed, onBeforeUpdate, ref, toRaw, VNodeRef, watch } from "vue";
import Draggable from "vuedraggable";
import { QResizeObserver } from "quasar";
import AudioCell from "./AudioCell.vue";
import AudioDetail from "./AudioDetail.vue";
import AudioInfo from "./AudioInfo.vue";
import CharacterPortrait from "./CharacterPortrait.vue";
import ToolBar from "./ToolBar.vue";
import { useStore } from "@/store";
import ProgressView from "@/components/ProgressView.vue";
import EngineStartupOverlay from "@/components/EngineStartupOverlay.vue";
import { AudioItem } from "@/store/type";
import {
  AudioKey,
  PresetKey,
  SplitterPositionType,
  Voice,
  HotkeyActionNameType,
  actionPostfixSelectNthCharacter,
} from "@/type/preload";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import onetimeWatch from "@/helpers/onetimeWatch";

const props = defineProps<{
  isEnginesReady: boolean;
  isProjectFileLoaded: boolean | "waiting";
}>();

const store = useStore();

const audioKeys = computed(() => store.state.audioKeys);
const uiLocked = computed(() => store.getters.UI_LOCKED);

const isMultiSelectEnabled = computed(
  () => store.state.experimentalSetting.enableMultiSelect,
);

const { registerHotkeyWithCleanup } = useHotkeyManager();

registerHotkeyWithCleanup({
  editor: "talk",
  name: "音声書き出し",
  callback: () => {
    if (!uiLocked.value) {
      store.dispatch("SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG");
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "選択音声を書き出し",
  callback: () => {
    if (!uiLocked.value) {
      store.dispatch("SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG");
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "音声を繋げて書き出し",
  callback: () => {
    if (!uiLocked.value) {
      store.dispatch("SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG");
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "テキストを読み込む",
  callback: () => {
    if (!uiLocked.value) {
      store.dispatch("SHOW_CONNECT_AND_EXPORT_TEXT_DIALOG");
    }
  },
});

registerHotkeyWithCleanup({
  editor: "talk",
  name: "テキスト欄にフォーカスを戻す",
  callback: () => {
    if (activeAudioKey.value != undefined) {
      focusCell({ audioKey: activeAudioKey.value, focusTarget: "textField" });
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: true,
  name: "テキスト欄を複製",
  callback: () => {
    if (activeAudioKey.value != undefined) {
      duplicateAudioItem();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: true,
  name: "テキスト欄を追加",
  callback: () => {
    if (!uiLocked.value) {
      addAudioItem();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: true,
  name: "テキスト欄を削除",
  callback: () => {
    if (!uiLocked.value) {
      removeAudioItem();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: true,
  name: "テキスト欄からフォーカスを外す",
  callback: () => {
    if (!uiLocked.value) {
      if (document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur();
      }
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: false,
  name: "すべて選択",
  callback: () => {
    if (!uiLocked.value && isMultiSelectEnabled.value) {
      store.dispatch("SET_SELECTED_AUDIO_KEYS", {
        audioKeys: audioKeys.value,
      });
    }
  },
});
for (let i = 0; i < 10; i++) {
  registerHotkeyWithCleanup({
    editor: "talk",
    enableInTextbox: true,
    name: `${i + 1}${actionPostfixSelectNthCharacter}` as HotkeyActionNameType,
    callback: () => {
      if (!uiLocked.value) {
        onCharacterSelectHotkey(i);
      }
    },
  });
}

const removeAudioItem = async () => {
  if (activeAudioKey.value == undefined) throw new Error();
  audioCellRefs[activeAudioKey.value].removeCell();
};

const onCharacterSelectHotkey = async (selectedCharacterIndex: number) => {
  if (activeAudioKey.value == undefined) throw new Error();
  audioCellRefs[activeAudioKey.value].selectCharacterAt(selectedCharacterIndex);
};

// view
const DEFAULT_PORTRAIT_PANE_WIDTH = 22; // %
const MIN_PORTRAIT_PANE_WIDTH = 0;
const MAX_PORTRAIT_PANE_WIDTH = 40;
const DEFAULT_AUDIO_INFO_PANE_WIDTH = 200; // px
const MIN_AUDIO_INFO_PANE_WIDTH = 160;
const MAX_AUDIO_INFO_PANE_WIDTH = 250;
const MIN_AUDIO_DETAIL_PANE_HEIGHT = 185; // px
const MAX_AUDIO_DETAIL_PANE_HEIGHT = 500;

const portraitPaneWidth = ref(0);
const audioInfoPaneWidth = ref(0);
const audioInfoPaneMinWidth = ref(0);
const audioInfoPaneMaxWidth = ref(0);
const audioDetailPaneHeight = ref(0);
const audioDetailPaneMinHeight = ref(0);
const audioDetailPaneMaxHeight = ref(0);

const changeAudioDetailPaneMaxHeight = (height: number) => {
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

const splitterPosition = computed<SplitterPositionType>(
  () => store.state.splitterPosition,
);

const updateSplitterPosition = async (
  propertyName: keyof SplitterPositionType,
  newValue: number,
) => {
  const newSplitterPosition = {
    ...splitterPosition.value,
    [propertyName]: newValue,
  };
  await store.dispatch("SET_ROOT_MISC_SETTING", {
    key: "splitterPosition",
    value: newSplitterPosition,
  });
};

const updatePortraitPane = async (width: number) => {
  portraitPaneWidth.value = width;
  await updateSplitterPosition("portraitPaneWidth", width);
};

const updateAudioInfoPane = async (width: number) => {
  audioInfoPaneWidth.value = width;
  await updateSplitterPosition("audioInfoPaneWidth", width);
};

const updateAudioDetailPane = async (height: number) => {
  audioDetailPaneHeight.value = height;
  await updateSplitterPosition("audioDetailPaneHeight", height);
};
// component
let audioCellRefs: Record<AudioKey, InstanceType<typeof AudioCell>> = {};
const addAudioCellRef: VNodeRef = (audioCellRef) => {
  if (audioCellRef && !(audioCellRef instanceof Element)) {
    const typedAudioCellRef = audioCellRef as InstanceType<typeof AudioCell>;
    audioCellRefs[typedAudioCellRef.audioKey] = typedAudioCellRef;
  }
};
onBeforeUpdate(() => {
  audioCellRefs = {};
});

const resizeObserverRef = ref<QResizeObserver>();

// DaD
const updateAudioKeys = (audioKeys: AudioKey[]) =>
  store.dispatch("COMMAND_SET_AUDIO_KEYS", { audioKeys });
const itemKey = (key: string) => key;

// セルを追加
const activeAudioKey = computed<AudioKey | undefined>(
  () => store.getters.ACTIVE_AUDIO_KEY,
);
const addAudioItem = async () => {
  const prevAudioKey = activeAudioKey.value;
  let voice: Voice | undefined = undefined;
  let presetKey: PresetKey | undefined = undefined;
  let baseAudioItem: AudioItem | undefined = undefined;

  if (prevAudioKey != undefined) {
    voice = store.state.audioItems[prevAudioKey].voice;
    presetKey = store.state.audioItems[prevAudioKey].presetKey;
    baseAudioItem = store.state.audioItems[prevAudioKey];
  }

  const audioItem = await store.dispatch("GENERATE_AUDIO_ITEM", {
    voice,
    presetKey,
    baseAudioItem,
  });

  const newAudioKey = await store.dispatch("COMMAND_REGISTER_AUDIO_ITEM", {
    audioItem,
    prevAudioKey: activeAudioKey.value,
  });
  audioCellRefs[newAudioKey].focusCell({ focusTarget: "textField" });
};
const duplicateAudioItem = async () => {
  const prevAudioKey = activeAudioKey.value;

  // audioItemが選択されていない状態で押されたら何もしない
  if (prevAudioKey == undefined) return;

  const prevAudioItem = toRaw(store.state.audioItems[prevAudioKey]);

  const newAudioKey = await store.dispatch("COMMAND_REGISTER_AUDIO_ITEM", {
    audioItem: structuredClone(prevAudioItem),
    prevAudioKey: activeAudioKey.value,
  });
  audioCellRefs[newAudioKey].focusCell({ focusTarget: "textField" });
};

// Pane
const shouldShowPanes = computed<boolean>(
  () => store.getters.SHOULD_SHOW_PANES,
);
watch(shouldShowPanes, (val, old) => {
  if (val === old) return;

  if (val) {
    const clamp = (value: number, min: number, max: number) =>
      Math.max(Math.min(value, max), min);

    // 設定ファイルを書き換えれば異常な値が入り得るのですべてclampしておく
    portraitPaneWidth.value = clamp(
      splitterPosition.value.portraitPaneWidth ?? DEFAULT_PORTRAIT_PANE_WIDTH,
      MIN_PORTRAIT_PANE_WIDTH,
      MAX_PORTRAIT_PANE_WIDTH,
    );

    audioInfoPaneWidth.value = clamp(
      splitterPosition.value.audioInfoPaneWidth ??
        DEFAULT_AUDIO_INFO_PANE_WIDTH,
      MIN_AUDIO_INFO_PANE_WIDTH,
      MAX_AUDIO_INFO_PANE_WIDTH,
    );
    audioInfoPaneMinWidth.value = MIN_AUDIO_INFO_PANE_WIDTH;
    audioInfoPaneMaxWidth.value = MAX_AUDIO_INFO_PANE_WIDTH;

    audioDetailPaneMinHeight.value = MIN_AUDIO_DETAIL_PANE_HEIGHT;
    changeAudioDetailPaneMaxHeight(
      resizeObserverRef.value?.$el.parentElement.clientHeight,
    );

    audioDetailPaneHeight.value = clamp(
      splitterPosition.value.audioDetailPaneHeight ??
        MIN_AUDIO_DETAIL_PANE_HEIGHT,
      audioDetailPaneMinHeight.value,
      audioDetailPaneMaxHeight.value,
    );
  } else {
    portraitPaneWidth.value = 0;
    audioInfoPaneWidth.value = 0;
    audioInfoPaneMinWidth.value = 0;
    audioInfoPaneMaxWidth.value = 0;
    audioDetailPaneHeight.value = 0;
    audioDetailPaneMinHeight.value = 0;
    audioDetailPaneMaxHeight.value = 0;
  }
});

// セルをフォーカス
const focusCell = ({
  audioKey,
  focusTarget,
}: {
  audioKey: AudioKey;
  focusTarget?: "root" | "textField";
}) => {
  audioCellRefs[audioKey].focusCell({
    focusTarget: focusTarget ?? "textField",
  });
};

const userOrderedCharacterInfos = computed(
  () => store.state.userCharacterOrder,
);
const audioItems = computed(() => store.state.audioItems);
// 並び替え後、テキスト欄が１つで空欄なら話者を更新
// 経緯 https://github.com/VOICEVOX/voicevox/issues/1229
watch(userOrderedCharacterInfos, (userOrderedCharacterInfos) => {
  if (userOrderedCharacterInfos.length < 1) {
    return;
  }

  if (audioKeys.value.length === 1) {
    const first = audioKeys.value[0] as AudioKey;
    const audioItem = audioItems.value[first];
    if (audioItem.text.length > 0) {
      return;
    }

    const speakerId = userOrderedCharacterInfos[0];
    const defaultStyleId = store.state.defaultStyleIds.find(
      (styleId) => styleId.speakerUuid === speakerId,
    );
    if (!defaultStyleId || audioItem.voice.speakerId === speakerId) return;

    const voice: Voice = {
      engineId: defaultStyleId.engineId,
      speakerId: defaultStyleId.speakerUuid,
      styleId: defaultStyleId.defaultStyleId,
    };

    // FIXME: UNDOができてしまうのでできれば直したい
    store.dispatch("COMMAND_MULTI_CHANGE_VOICE", {
      audioKeys: [first],
      voice: voice,
    });
  }
});

// エンジン初期化後の処理
const isCompletedInitialStartup = ref(false);
// TODO: Vueっぽくないので解体する
onetimeWatch(
  () => props.isProjectFileLoaded,
  async (isProjectFileLoaded) => {
    if (isProjectFileLoaded == "waiting" || !props.isEnginesReady)
      return "continue";
    if (!isProjectFileLoaded) {
      // 最初のAudioCellを作成
      const audioItem = await store.dispatch("GENERATE_AUDIO_ITEM", {});
      const newAudioKey = await store.dispatch("REGISTER_AUDIO_ITEM", {
        audioItem,
      });
      focusCell({ audioKey: newAudioKey, focusTarget: "textField" });

      // 最初の話者を初期化
      store.dispatch("SETUP_SPEAKER", {
        audioKeys: [newAudioKey],
        engineId: audioItem.voice.engineId,
        styleId: audioItem.voice.styleId,
      });
    }

    isCompletedInitialStartup.value = true;

    return "unwatch";
  },
  {
    immediate: true,
  },
);

// 代替ポート情報の変更を監視
watch(
  () => [store.state.altPortInfos, store.state.isVuexReady],
  async () => {
    // この watch がエンジンが起動した時 (=> 設定ファイルを読み込む前) に発火して, "今後この通知をしない" を無視するのを防ぐ
    if (!store.state.isVuexReady) return;

    // "今後この通知をしない" を考慮
    if (store.state.confirmedTips.engineStartedOnAltPort) return;

    // 代替ポートをトースト通知する
    for (const engineId of store.state.engineIds) {
      const engineName = store.state.engineInfos[engineId].name;
      const altPort = store.state.altPortInfos[engineId];
      if (!altPort) return;

      store.dispatch("SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON", {
        message: `${altPort.from}番ポートが使用中であるため ${engineName} は、${altPort.to}番ポートで起動しました`,
        icon: "compare_arrows",
        tipName: "engineStartedOnAltPort",
      });
    }
  },
);

// ドラッグ＆ドロップ
const dragEventCounter = ref(0);
const loadDraggedFile = (event: { dataTransfer: DataTransfer | null }) => {
  if (!event.dataTransfer || event.dataTransfer.files.length === 0) return;
  const file = event.dataTransfer.files[0];
  switch (path.extname(file.name)) {
    case ".txt":
      store.dispatch("COMMAND_IMPORT_FROM_FILE", { filePath: file.path });
      break;
    case ".vvproj":
      store.dispatch("LOAD_PROJECT_FILE", { filePath: file.path });
      break;
    default:
      store.dispatch("SHOW_ALERT_DIALOG", {
        title: "対応していないファイルです",
        message:
          "テキストファイル (.txt) とVOICEVOXプロジェクトファイル (.vvproj) に対応しています。",
      });
  }
};

// AudioCellの自動スクロール
const cellsRef = ref<InstanceType<typeof Draggable> | undefined>();
watch(activeAudioKey, (audioKey) => {
  if (audioKey == undefined) return;
  const activeCellElement = audioCellRefs[audioKey].$el;
  const cellsElement = cellsRef.value?.$el;
  if (
    !(activeCellElement instanceof Element) ||
    !(cellsElement instanceof Element)
  )
    throw new Error(
      `invalid element: activeCellElement=${activeCellElement}, cellsElement=${cellsElement}`,
    );
  const activeCellRect = activeCellElement.getBoundingClientRect();
  const cellsRect = cellsElement.getBoundingClientRect();
  const overflowTop = activeCellRect.top <= cellsRect.top;
  const overflowBottom = activeCellRect.bottom >= cellsRect.bottom;
  if (overflowTop || overflowBottom) {
    activeCellElement.scrollIntoView(overflowTop || !overflowBottom);
  }
});

const showAddAudioItemButton = computed(() => {
  return store.state.showAddAudioItemButton;
});

// 台本欄の空きスペースがクリックされたら選択解除
const onAudioCellPaneClick = () => {
  if (
    store.state.experimentalSetting.enableMultiSelect &&
    activeAudioKey.value
  ) {
    store.dispatch("SET_SELECTED_AUDIO_KEYS", {
      audioKeys: [activeAudioKey.value],
    });
  }
};
</script>

<style scoped lang="scss">
@use "@/styles/variables" as vars;
@use "@/styles/colors" as colors;

.q-header {
  height: vars.$toolbar-height;
}

.layout-container {
  min-height: calc(100vh - #{vars.$menubar-height});
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

.main-row-panes {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0;

  display: flex;

  .q-splitter--horizontal {
    height: calc(
      100vh - #{vars.$menubar-height + vars.$toolbar-height +
        vars.$window-border-width}
    );
  }
}

.ghost {
  background-color: rgba(colors.$display-rgb, 0.15);
}

.audio-cell-pane {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0;

  position: relative;
  height: 100%;

  &.is-dragging {
    background-color: rgba(colors.$display-rgb, 0.15);
  }

  .audio-cells {
    overflow-x: hidden;
    overflow-y: scroll;

    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;

    padding-bottom: 70px;
  }

  .draggable-cursor {
    cursor: grab;
  }

  .add-button-wrapper {
    position: absolute;
    right: 0px;
    bottom: 0px;

    margin-right: 26px;
    margin-bottom: 10px;
  }
}

.q-splitter > :deep(.home-splitter) {
  background: colors.$splitter !important;
}
</style>
