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
                      :class="{ 'is-dragging': fileDropEventCounter > 0 }"
                      @dragenter="fileDropEventCounter++"
                      @dragleave="fileDropEventCounter--"
                      @dragover.prevent
                      @drop.prevent="
                        fileDropEventCounter = 0;
                        loadDroppedFile($event);
                      "
                    >
                      <Draggable
                        ref="cellsRef"
                        class="audio-cells"
                        :modelValue="audioKeys"
                        :itemKey
                        ghostClass="ghost"
                        filter="input"
                        :preventOnFilter="false"
                        @start="onReorderStart"
                        @end="onReorderEnd"
                        @click.self="onAudioCellPaneClick"
                      >
                        <template #item="{ element: audioKey }">
                          <AudioCell
                            :ref="addAudioCellRef"
                            class="draggable-cursor"
                            :class="{
                              // 並び替え中はドラッグしているAudioCell以外の選択中のAudioCellは非表示にする
                              // TODO: SortableJSのmulti drag pluginを使う（https://github.com/SortableJS/Sortable/tree/master/plugins/MultiDrag）
                              hidden:
                                reorderingState.isReordering &&
                                selectedAudioKeys.includes(audioKey) &&
                                reorderingState.holdingAudioKey !== audioKey,
                            }"
                            :audioKey
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
                      <!-- 合計再生時間の表示（ステータス） -->
                      <div
                        v-if="showTotalAudioLength"
                        class="total-audio-status"
                      >
                        合計: {{ formattedTotalAudioLength }}
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
} from "@/type/preload";
import { useHotkeyManager } from "@/plugins/hotkeyPlugin";
import onetimeWatch from "@/helpers/onetimeWatch";
import path from "@/helpers/path";
import {
  actionPostfixSelectNthCharacter,
  HotkeyActionNameType,
} from "@/domain/hotkeyAction";
import { isElectron } from "@/helpers/platform";
import { dragAndDropReorder } from "@/helpers/reorderHelper";

const props = defineProps<{
  isEnginesReady: boolean;
  isProjectFileLoaded: boolean | "waiting";
}>();

const store = useStore();

const audioKeys = computed(() => store.state.audioKeys);
const selectedAudioKeys = computed(() => store.getters.SELECTED_AUDIO_KEYS);
const uiLocked = computed(() => store.getters.UI_LOCKED);

const isMultiSelectEnabled = computed(() => store.state.enableMultiSelect);

const showTotalAudioLength = computed(() => store.state.showTotalAudioLength);
const totalAudioLength = computed(() => store.getters.TOTAL_AUDIO_LENGTH);
const formattedTotalAudioLength = computed(() => {
  const totalSeconds = Math.floor(totalAudioLength.value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
});

const { registerHotkeyWithCleanup } = useHotkeyManager();

registerHotkeyWithCleanup({
  editor: "talk",
  name: "音声書き出し",
  callback: () => {
    if (!uiLocked.value) {
      void store.actions.SHOW_GENERATE_AND_SAVE_ALL_AUDIO_DIALOG();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "選択音声を書き出し",
  callback: () => {
    if (!uiLocked.value) {
      void store.actions.SHOW_GENERATE_AND_SAVE_SELECTED_AUDIO_DIALOG();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "音声を繋げて書き出し",
  callback: () => {
    if (!uiLocked.value) {
      void store.actions.SHOW_GENERATE_AND_CONNECT_ALL_AUDIO_DIALOG();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  name: "テキストを読み込む",
  callback: () => {
    if (!uiLocked.value) {
      void store.actions.SHOW_CONNECT_AND_EXPORT_TEXT_DIALOG();
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
      void duplicateAudioItem();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: true,
  name: "テキスト欄を追加",
  callback: () => {
    if (!uiLocked.value) {
      void addAudioItem();
    }
  },
});
registerHotkeyWithCleanup({
  editor: "talk",
  enableInTextbox: true,
  name: "テキスト欄を削除",
  callback: () => {
    if (!uiLocked.value) {
      void removeAudioItem();
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
      void store.actions.SET_SELECTED_AUDIO_KEYS({
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
        void onCharacterSelectHotkey(i);
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
  await store.actions.SET_ROOT_MISC_SETTING({
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

// 並び替え
const itemKey = (key: string) => key;
type DraggableEvent = CustomEvent & {
  oldIndex: number;
  newIndex: number | null;
};

type ReorderingState =
  | { isReordering: false }
  | { isReordering: true; holdingAudioKey: AudioKey };

const reorderingState = ref<ReorderingState>({ isReordering: false });

const onReorderStart = (e: DraggableEvent) => {
  const audioKey = audioKeys.value[e.oldIndex];
  if (!selectedAudioKeys.value.includes(audioKey)) {
    // 選択されていないものがドラッグされた場合は、クリックしたときにフォーカスを移す
    void store.actions.SET_ACTIVE_AUDIO_KEY({ audioKey });
    void store.actions.SET_SELECTED_AUDIO_KEYS({
      audioKeys: [audioKey],
    });
  }
  reorderingState.value = { isReordering: true, holdingAudioKey: audioKey };
};
const onReorderEnd = (e: DraggableEvent) => {
  reorderingState.value = { isReordering: false };
  if (e.newIndex == undefined) return;

  const newAudioKeys = dragAndDropReorder(
    audioKeys.value,
    new Set(selectedAudioKeys.value),
    e.oldIndex,
    e.newIndex,
  );

  void store.actions.COMMAND_SET_AUDIO_KEYS({
    audioKeys: newAudioKeys,
  });
};

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

  const audioItem = await store.actions.GENERATE_AUDIO_ITEM({
    voice,
    presetKey,
    baseAudioItem,
  });

  const newAudioKey = await store.actions.COMMAND_REGISTER_AUDIO_ITEM({
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

  const newAudioKey = await store.actions.COMMAND_REGISTER_AUDIO_ITEM({
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
    const first = audioKeys.value[0];
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
    void store.actions.COMMAND_MULTI_CHANGE_VOICE({
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
      const audioItem = await store.actions.GENERATE_AUDIO_ITEM({});
      const newAudioKey = await store.actions.REGISTER_AUDIO_ITEM({
        audioItem,
      });
      focusCell({ audioKey: newAudioKey, focusTarget: "textField" });

      // 最初の話者を初期化
      void store.actions.SETUP_SPEAKER({
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
      const defaultPort = store.state.engineInfos[engineId].defaultPort;
      const altPort = store.state.altPortInfos[engineId];
      if (!altPort) return;

      void store.actions.SHOW_NOTIFY_AND_NOT_SHOW_AGAIN_BUTTON({
        message: `${defaultPort}番ポートが使用中であるため ${engineName} は、${altPort}番ポートで起動しました`,
        icon: "compare_arrows",
        tipName: "engineStartedOnAltPort",
      });
    }
  },
);

// ファイルのドロップ
const fileDropEventCounter = ref(0);
const loadDroppedFile = async (event: {
  dataTransfer: DataTransfer | null;
}) => {
  if (!event.dataTransfer || event.dataTransfer.files.length === 0) return;
  const file = event.dataTransfer.files[0];

  // electronの場合のみファイルパスを取得できる
  const filePath = isElectron
    ? await window.backend.getPathForFile(file)
    : undefined;

  switch (path.extname(file.name)) {
    case ".txt":
      if (filePath) {
        void store.actions.COMMAND_IMPORT_FROM_FILE({ type: "path", filePath });
      } else {
        void store.actions.COMMAND_IMPORT_FROM_FILE({ type: "file", file });
      }
      break;

    case ".vvproj":
      if (filePath) {
        void store.actions.LOAD_PROJECT_FILE({ type: "path", filePath });
      } else {
        void store.actions.LOAD_PROJECT_FILE({ type: "file", file });
      }
      break;

    default:
      void store.actions.SHOW_ALERT_DIALOG({
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
  if (store.state.enableMultiSelect && activeAudioKey.value) {
    void store.actions.SET_SELECTED_AUDIO_KEYS({
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

// :not(#dummy) で優先度を上げ、選択中の背景色より優先されるようにする
.ghost:not(#dummy) {
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
    z-index: 20;
  }
}

.q-splitter > :deep(.home-splitter) {
  background: colors.$splitter !important;
}

.total-audio-status {
  position: absolute;
  right: 92px;
  bottom: 22px; // 追加ボタンfabの左側
  background-color: colors.$surface;
  color: colors.$display;
  padding: 4px 12px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  z-index: 10;
  pointer-events: none; // クリックを透過させて操作の邪魔をしない
  opacity: 0.8;
  font-size: 0.9em;
  border: 1px solid colors.$splitter;
}
</style>
