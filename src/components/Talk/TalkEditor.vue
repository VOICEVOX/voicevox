<template>
  <menu-bar />

  <q-layout reveal elevated container class="layout-container">
    <header-bar />

    <q-page-container>
      <q-page class="main-row-panes">
        <progress-view />

        <!-- TODO: 複数エンジン対応 -->
        <!-- TODO: allEngineStateが "ERROR" のときエラーになったエンジンを探してトーストで案内 -->
        <div v-if="allEngineState === 'FAILED_STARTING'" class="waiting-engine">
          <div>
            エンジンの起動に失敗しました。エンジンの再起動をお試しください。
          </div>
        </div>
        <div
          v-else-if="
            !isCompletedInitialStartup || allEngineState === 'STARTING'
          "
          class="waiting-engine"
        >
          <div>
            <q-spinner color="primary" size="2.5rem" />
            <div class="q-mt-xs">
              {{
                allEngineState === "STARTING"
                  ? "エンジン起動中・・・"
                  : "データ準備中・・・"
              }}
            </div>

            <template v-if="isEngineWaitingLong">
              <q-separator spaced />
              エンジン起動に時間がかかっています。<br />
              <q-btn
                v-if="isMultipleEngine"
                outline
                :disable="reloadingLocked"
                @click="reloadAppWithMultiEngineOffMode"
              >
                マルチエンジンをオフにして再読み込みする</q-btn
              >
              <q-btn v-else outline @click="openQa">Q&Aを見る</q-btn>
            </template>
          </div>
        </div>
        <q-splitter
          horizontal
          reverse
          unit="px"
          :limits="[audioDetailPaneMinHeight, audioDetailPaneMaxHeight]"
          separator-class="home-splitter"
          :separator-style="{ height: shouldShowPanes ? '3px' : '0' }"
          class="full-width"
          before-class="overflow-hidden"
          :disable="!shouldShowPanes"
          :model-value="audioDetailPaneHeight"
          @update:model-value="updateAudioDetailPane"
        >
          <template #before>
            <q-splitter
              :limits="[MIN_PORTRAIT_PANE_WIDTH, MAX_PORTRAIT_PANE_WIDTH]"
              separator-class="home-splitter"
              :separator-style="{ width: shouldShowPanes ? '3px' : '0' }"
              before-class="overflow-hidden"
              :disable="!shouldShowPanes"
              :model-value="portraitPaneWidth"
              @update:model-value="updatePortraitPane"
            >
              <template #before>
                <character-portrait />
              </template>
              <template #after>
                <q-splitter
                  reverse
                  unit="px"
                  :limits="[audioInfoPaneMinWidth, audioInfoPaneMaxWidth]"
                  separator-class="home-splitter"
                  :separator-style="{ width: shouldShowPanes ? '3px' : '0' }"
                  class="full-width overflow-hidden"
                  :disable="!shouldShowPanes"
                  :model-value="audioInfoPaneWidth"
                  @update:model-value="updateAudioInfoPane"
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
                      <draggable
                        ref="cellsRef"
                        class="audio-cells"
                        :model-value="audioKeys"
                        :item-key="itemKey"
                        ghost-class="ghost"
                        filter="input"
                        :prevent-on-filter="false"
                        @update:model-value="updateAudioKeys"
                      >
                        <template #item="{ element }">
                          <audio-cell
                            :ref="addAudioCellRef"
                            class="draggable-cursor"
                            :audio-key="element"
                            @focus-cell="focusCell"
                          />
                        </template>
                      </draggable>
                      <div
                        v-if="showAddAudioItemButton"
                        class="add-button-wrapper"
                      >
                        <q-btn
                          fab
                          icon="add"
                          color="primary"
                          text-color="display-on-primary"
                          :disable="uiLocked"
                          aria-label="テキストを追加"
                          @click="addAudioItem"
                        ></q-btn>
                      </div>
                    </div>
                  </template>
                  <template #after>
                    <audio-info
                      v-if="activeAudioKey != undefined"
                      :active-audio-key="activeAudioKey"
                    />
                  </template>
                </q-splitter>
              </template>
            </q-splitter>
          </template>
          <template #after>
            <audio-detail
              v-if="activeAudioKey != undefined"
              :active-audio-key="activeAudioKey"
            />
          </template>
        </q-splitter>

        <q-resize-observer
          ref="resizeObserverRef"
          @resize="({ height }) => changeAudioDetailPaneMaxHeight(height)"
        />
      </q-page>
    </q-page-container>
  </q-layout>
  <help-dialog v-model="isHelpDialogOpenComputed" />
  <setting-dialog v-model="isSettingDialogOpenComputed" />
  <hotkey-setting-dialog v-model="isHotkeySettingDialogOpenComputed" />
  <header-bar-custom-dialog v-model="isToolbarSettingDialogOpenComputed" />
  <character-order-dialog
    v-if="orderedAllCharacterInfos.length > 0"
    v-model="isCharacterOrderDialogOpenComputed"
    :character-infos="orderedAllCharacterInfos"
  />
  <default-style-list-dialog
    v-if="orderedTalkCharacterInfos.length > 0"
    v-model="isDefaultStyleSelectDialogOpenComputed"
    :character-infos="orderedTalkCharacterInfos"
  />
  <dictionary-manage-dialog v-model="isDictionaryManageDialogOpenComputed" />
  <engine-manage-dialog v-model="isEngineManageDialogOpenComputed" />
  <accept-retrieve-telemetry-dialog
    v-model="isAcceptRetrieveTelemetryDialogOpenComputed"
  />
  <accept-terms-dialog v-model="isAcceptTermsDialogOpenComputed" />
  <update-notification-dialog-container
    :can-open-dialog="canOpenNotificationDialog"
  />
</template>

<script setup lang="ts">
import path from "path";
import { computed, onBeforeUpdate, onMounted, ref, VNodeRef, watch } from "vue";
import draggable from "vuedraggable";
import { QResizeObserver } from "quasar";
import cloneDeep from "clone-deep";
import AudioCell from "./AudioCell.vue";
import AudioDetail from "./AudioDetail.vue";
import AudioInfo from "./AudioInfo.vue";
import CharacterPortrait from "./CharacterPortrait.vue";
import { useStore } from "@/store";
import HeaderBar from "@/components/HeaderBar.vue";
import MenuBar from "@/components/Talk/MenuBar.vue";
import HelpDialog from "@/components/Dialog/HelpDialog/HelpDialog.vue";
import SettingDialog from "@/components/Dialog/SettingDialog.vue";
import HotkeySettingDialog from "@/components/Dialog/HotkeySettingDialog.vue";
import HeaderBarCustomDialog from "@/components/Dialog/HeaderBarCustomDialog.vue";
import DefaultStyleListDialog from "@/components/Dialog/DefaultStyleListDialog.vue";
import CharacterOrderDialog from "@/components/Dialog/CharacterOrderDialog.vue";
import AcceptRetrieveTelemetryDialog from "@/components/Dialog/AcceptRetrieveTelemetryDialog.vue";
import AcceptTermsDialog from "@/components/Dialog/AcceptTermsDialog.vue";
import DictionaryManageDialog from "@/components/Dialog/DictionaryManageDialog.vue";
import EngineManageDialog from "@/components/Dialog/EngineManageDialog.vue";
import ProgressView from "@/components/ProgressView.vue";
import UpdateNotificationDialogContainer from "@/components/Dialog/UpdateNotificationDialog/Container.vue";
import { AudioItem, EngineState } from "@/store/type";
import {
  AudioKey,
  HotkeyActionType,
  HotkeyReturnType,
  PresetKey,
  SplitterPositionType,
  Voice,
} from "@/type/preload";
import { filterCharacterInfosByStyleType } from "@/store/utility";
import { parseCombo, setHotkeyFunctions } from "@/store/setting";

const props =
  defineProps<{
    projectFilePath?: string;
    isEnginesReady: boolean;
  }>();

const store = useStore();

const audioKeys = computed(() => store.state.audioKeys);
const uiLocked = computed(() => store.getters.UI_LOCKED);
const reloadingLocked = computed(() => store.state.reloadingLock);

const isMultipleEngine = computed(() => store.state.engineIds.length > 1);

// hotkeys handled by Mousetrap
const hotkeyMap = new Map<HotkeyActionType, () => HotkeyReturnType>([
  [
    "テキスト欄にフォーカスを戻す",
    () => {
      if (activeAudioKey.value != undefined) {
        focusCell({ audioKey: activeAudioKey.value, focusTarget: "textField" });
      }
      return false; // this is the same with event.preventDefault()
    },
  ],
  [
    // FIXME: テキスト欄にフォーカスがある状態でも実行できるようにする
    // https://github.com/VOICEVOX/voicevox/pull/1096#issuecomment-1378651920
    "テキスト欄を複製",
    () => {
      if (activeAudioKey.value != undefined) {
        duplicateAudioItem();
      }
      return false;
    },
  ],
]);

setHotkeyFunctions(hotkeyMap);

const removeAudioItem = async () => {
  if (activeAudioKey.value == undefined) throw new Error();
  audioCellRefs[activeAudioKey.value].removeCell();
};

// convert the hotkey array to Map to get value with keys easier
// this only happens here where we deal with native methods
const hotkeySettingsMap = computed(
  () =>
    new Map(
      store.state.hotkeySettings.map((obj) => [obj.action, obj.combination])
    )
);

// hotkeys handled by native, for they are made to be working while focusing input elements
const hotkeyActionsNative = [
  (event: KeyboardEvent) => {
    if (
      !event.isComposing &&
      !uiLocked.value &&
      parseCombo(event) == hotkeySettingsMap.value.get("テキスト欄を追加")
    ) {
      addAudioItem();
      event.preventDefault();
    }
  },
  (event: KeyboardEvent) => {
    if (
      !event.isComposing &&
      !uiLocked.value &&
      parseCombo(event) == hotkeySettingsMap.value.get("テキスト欄を削除")
    ) {
      removeAudioItem();
      event.preventDefault();
    }
  },
  (event: KeyboardEvent) => {
    if (
      !event.isComposing &&
      !uiLocked.value &&
      parseCombo(event) ==
        hotkeySettingsMap.value.get("テキスト欄からフォーカスを外す")
    ) {
      if (document.activeElement instanceof HTMLInputElement) {
        document.activeElement.blur();
      }
      event.preventDefault();
    }
  },
];

// view
const DEFAULT_PORTRAIT_PANE_WIDTH = 25; // %
const MIN_PORTRAIT_PANE_WIDTH = 0;
const MAX_PORTRAIT_PANE_WIDTH = 40;
const MIN_AUDIO_INFO_PANE_WIDTH = 160; // px
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
  () => store.state.splitterPosition
);

const updateSplitterPosition = async (
  propertyName: keyof SplitterPositionType,
  newValue: number
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
  () => store.getters.ACTIVE_AUDIO_KEY
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

  const prevAudioItem = store.state.audioItems[prevAudioKey];

  const newAudioKey = await store.dispatch("COMMAND_REGISTER_AUDIO_ITEM", {
    audioItem: cloneDeep(prevAudioItem),
    prevAudioKey: activeAudioKey.value,
  });
  audioCellRefs[newAudioKey].focusCell({ focusTarget: "textField" });
};

// Pane
const shouldShowPanes = computed<boolean>(
  () => store.getters.SHOULD_SHOW_PANES
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
      MAX_PORTRAIT_PANE_WIDTH
    );

    audioInfoPaneWidth.value = clamp(
      splitterPosition.value.audioInfoPaneWidth ?? MIN_AUDIO_INFO_PANE_WIDTH,
      MIN_AUDIO_INFO_PANE_WIDTH,
      MAX_AUDIO_INFO_PANE_WIDTH
    );
    audioInfoPaneMinWidth.value = MIN_AUDIO_INFO_PANE_WIDTH;
    audioInfoPaneMaxWidth.value = MAX_AUDIO_INFO_PANE_WIDTH;

    audioDetailPaneMinHeight.value = MIN_AUDIO_DETAIL_PANE_HEIGHT;
    changeAudioDetailPaneMaxHeight(
      resizeObserverRef.value?.$el.parentElement.clientHeight
    );

    audioDetailPaneHeight.value = clamp(
      splitterPosition.value.audioDetailPaneHeight ??
        MIN_AUDIO_DETAIL_PANE_HEIGHT,
      audioDetailPaneMinHeight.value,
      audioDetailPaneMaxHeight.value
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
  () => store.state.userCharacterOrder
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
      (styleId) => styleId.speakerUuid === speakerId
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

onMounted(async () => {
  // ショートカットキーの設定
  hotkeyActionsNative.forEach((item) => {
    document.addEventListener("keyup", item);
  });
});

// エンジン初期化後の処理
const isCompletedInitialStartup = ref(false);
const unwatchIsEnginesReady = watch(
  // TODO: 最初に１度だけ実行している。Vueっぽくないので解体する
  () => props.isEnginesReady,
  async (isEnginesReady) => {
    if (!isEnginesReady) return;

    // プロジェクトファイルが指定されていればロード
    let projectFileLoaded = false;
    if (props.projectFilePath != undefined && props.projectFilePath !== "") {
      projectFileLoaded = await store.dispatch("LOAD_PROJECT_FILE", {
        filePath: props.projectFilePath,
      });
    }

    if (!projectFileLoaded) {
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

    // 設定の読み込みを待機する
    // FIXME: 設定が必要な処理はINIT_VUEXを実行しているApp.vueで行うべき
    await store.dispatch("WAIT_VUEX_READY", { timeout: 15000 });

    isAcceptRetrieveTelemetryDialogOpenComputed.value =
      store.state.acceptRetrieveTelemetry === "Unconfirmed";

    isAcceptTermsDialogOpenComputed.value =
      import.meta.env.MODE !== "development" &&
      store.state.acceptTerms !== "Accepted";

    isCompletedInitialStartup.value = true;

    unwatchIsEnginesReady();
  },
  {
    immediate: true,
  }
);

// エンジン待機
// TODO: 個別のエンジンの状態をUIで確認できるようにする
const allEngineState = computed(() => {
  const engineStates = store.state.engineStates;

  let lastEngineState: EngineState | undefined = undefined;

  // 登録されているすべてのエンジンについて状態を確認する
  for (const engineId of store.state.engineIds) {
    const engineState: EngineState | undefined = engineStates[engineId];
    if (engineState == undefined)
      throw new Error(`No such engineState set: engineId == ${engineId}`);

    // FIXME: 1つでも接続テストに成功していないエンジンがあれば、暫定的に起動中とする
    if (engineState === "STARTING") {
      return engineState;
    }

    lastEngineState = engineState;
  }

  return lastEngineState; // FIXME: 暫定的に1つのエンジンの状態を返す
});

const isEngineWaitingLong = ref<boolean>(false);
let engineTimer: number | undefined = undefined;
watch(allEngineState, (newEngineState) => {
  if (engineTimer != undefined) {
    clearTimeout(engineTimer);
    engineTimer = undefined;
  }
  if (newEngineState === "STARTING") {
    isEngineWaitingLong.value = false;
    engineTimer = window.setTimeout(() => {
      isEngineWaitingLong.value = true;
    }, 30000);
  } else {
    isEngineWaitingLong.value = false;
  }
});

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
  }
);

const reloadAppWithMultiEngineOffMode = () => {
  store.dispatch("CHECK_EDITED_AND_NOT_SAVE", {
    closeOrReload: "reload",
    isMultiEngineOffMode: true,
  });
};

const openQa = () => {
  window.open("https://voicevox.hiroshiba.jp/qa/", "_blank");
};

// ライセンス表示
const isHelpDialogOpenComputed = computed({
  get: () => store.state.isHelpDialogOpen,
  set: (val) => store.dispatch("SET_DIALOG_OPEN", { isHelpDialogOpen: val }),
});

// 設定
const isSettingDialogOpenComputed = computed({
  get: () => store.state.isSettingDialogOpen,
  set: (val) => store.dispatch("SET_DIALOG_OPEN", { isSettingDialogOpen: val }),
});

// ショートカットキー設定
const isHotkeySettingDialogOpenComputed = computed({
  get: () => store.state.isHotkeySettingDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isHotkeySettingDialogOpen: val,
    }),
});

// ツールバーのカスタム設定
const isToolbarSettingDialogOpenComputed = computed({
  get: () => store.state.isToolbarSettingDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isToolbarSettingDialogOpen: val,
    }),
});

// 利用規約表示
const isAcceptTermsDialogOpenComputed = computed({
  get: () => store.state.isAcceptTermsDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isAcceptTermsDialogOpen: val,
    }),
});

// キャラクター並び替え
const orderedAllCharacterInfos = computed(
  () => store.getters.GET_ORDERED_ALL_CHARACTER_INFOS
);
const isCharacterOrderDialogOpenComputed = computed({
  get: () =>
    !store.state.isAcceptTermsDialogOpen &&
    store.state.isCharacterOrderDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isCharacterOrderDialogOpen: val,
    }),
});

// TODO: デフォルトスタイル選択(ソング)の実装
// デフォルトスタイル選択(トーク)
const orderedTalkCharacterInfos = computed(() => {
  return filterCharacterInfosByStyleType(
    store.getters.GET_ORDERED_ALL_CHARACTER_INFOS,
    "talk"
  );
});
const isDefaultStyleSelectDialogOpenComputed = computed({
  get: () =>
    !store.state.isAcceptTermsDialogOpen &&
    !store.state.isCharacterOrderDialogOpen &&
    store.state.isDefaultStyleSelectDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isDefaultStyleSelectDialogOpen: val,
    }),
});

// エンジン管理
const isEngineManageDialogOpenComputed = computed({
  get: () => store.state.isEngineManageDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isEngineManageDialogOpen: val,
    }),
});

// 読み方＆アクセント辞書
const isDictionaryManageDialogOpenComputed = computed({
  get: () => store.state.isDictionaryManageDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isDictionaryManageDialogOpen: val,
    }),
});

const isAcceptRetrieveTelemetryDialogOpenComputed = computed({
  get: () =>
    !store.state.isAcceptTermsDialogOpen &&
    !store.state.isCharacterOrderDialogOpen &&
    !store.state.isDefaultStyleSelectDialogOpen &&
    store.state.isAcceptRetrieveTelemetryDialogOpen,
  set: (val) =>
    store.dispatch("SET_DIALOG_OPEN", {
      isAcceptRetrieveTelemetryDialogOpen: val,
    }),
});

// エディタのアップデート確認ダイアログ
const canOpenNotificationDialog = computed(() => {
  return (
    !store.state.isAcceptTermsDialogOpen &&
    !store.state.isCharacterOrderDialogOpen &&
    !store.state.isDefaultStyleSelectDialogOpen &&
    !store.state.isAcceptRetrieveTelemetryDialogOpen &&
    isCompletedInitialStartup.value
  );
});

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
const cellsRef = ref<InstanceType<typeof draggable> | undefined>();
watch(activeAudioKey, (audioKey) => {
  if (audioKey == undefined) return;
  const activeCellElement = audioCellRefs[audioKey].$el;
  const cellsElement = cellsRef.value?.$el;
  if (
    !(activeCellElement instanceof Element) ||
    !(cellsElement instanceof Element)
  )
    throw new Error(
      `invalid element: activeCellElement=${activeCellElement}, cellsElement=${cellsElement}`
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
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-header {
  height: vars.$header-height;
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

.waiting-engine {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$surface;
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
    height: calc(
      100vh - #{vars.$menubar-height + vars.$header-height +
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
