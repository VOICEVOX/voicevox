<template>
  <menu-bar />

  <q-layout reveal elevated>
    <header-bar />

    <q-page-container>
      <q-page class="main-row-panes">
        <!-- TODO: 複数エンジン対応 -->
        <div
          v-if="!isCompletedInitialStartup || allEngineState === 'STARTING'"
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
          </div>
        </div>
        <q-splitter
          horizontal
          reverse
          unit="px"
          :limits="[audioDetailPaneMinHeight, audioDetailPaneMaxHeight]"
          separator-class="home-splitter"
          :separator-style="{ height: shouldShowPanes ? '3px' : 0 }"
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
              :separator-style="{ width: shouldShowPanes ? '3px' : 0 }"
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
                  :separator-style="{ width: shouldShowPanes ? '3px' : 0 }"
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
                    >
                      <draggable
                        class="audio-cells"
                        :modelValue="audioKeys"
                        @update:modelValue="updateAudioKeys"
                        :itemKey="itemKey"
                        ghost-class="ghost"
                        filter="input"
                        :preventOnFilter="false"
                      >
                        <template v-slot:item="{ element }">
                          <audio-cell
                            class="draggable-cursor"
                            :audioKey="element"
                            :ref="addAudioCellRef"
                            @focusCell="focusCell"
                          />
                        </template>
                      </draggable>
                      <div class="add-button-wrapper">
                        <q-btn
                          fab
                          icon="add"
                          color="primary-light"
                          text-color="button-icon"
                          :disable="uiLocked"
                          @click="addAudioItem"
                        ></q-btn>
                      </div>
                    </div>
                  </template>
                  <template #after>
                    <audio-info
                      v-if="activeAudioKey != undefined"
                      :activeAudioKey="activeAudioKey"
                    />
                  </template>
                </q-splitter>
              </template>
            </q-splitter>
          </template>
          <template #after>
            <audio-detail
              v-if="activeAudioKey != undefined"
              :activeAudioKey="activeAudioKey"
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
    v-if="characterInfos"
    :characterInfos="characterInfos"
    v-model="isCharacterOrderDialogOpenComputed"
  />
  <default-style-select-dialog
    v-if="characterInfos"
    :characterInfos="characterInfos"
    v-model="isDefaultStyleSelectDialogOpenComputed"
  />
  <dictionary-manage-dialog v-model="isDictionaryManageDialogOpenComputed" />
  <accept-retrieve-telemetry-dialog
    v-model="isAcceptRetrieveTelemetryDialogOpenComputed"
  />
  <accept-terms-dialog v-model="isAcceptTermsDialogOpenComputed" />
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
import { useStore } from "@/store";
import draggable from "vuedraggable";
import HeaderBar from "@/components/HeaderBar.vue";
import AudioCell from "@/components/AudioCell.vue";
import AudioDetail from "@/components/AudioDetail.vue";
import AudioInfo from "@/components/AudioInfo.vue";
import MenuBar from "@/components/MenuBar.vue";
import HelpDialog from "@/components/HelpDialog.vue";
import SettingDialog from "@/components/SettingDialog.vue";
import HotkeySettingDialog from "@/components/HotkeySettingDialog.vue";
import HeaderBarCustomDialog from "@/components/HeaderBarCustomDialog.vue";
import CharacterPortrait from "@/components/CharacterPortrait.vue";
import DefaultStyleSelectDialog from "@/components/DefaultStyleSelectDialog.vue";
import CharacterOrderDialog from "@/components/CharacterOrderDialog.vue";
import AcceptRetrieveTelemetryDialog from "@/components/AcceptRetrieveTelemetryDialog.vue";
import AcceptTermsDialog from "@/components/AcceptTermsDialog.vue";
import DictionaryManageDialog from "@/components/DictionaryManageDialog.vue";
import { AudioItem, EngineState } from "@/store/type";
import { QResizeObserver, useQuasar } from "quasar";
import path from "path";
import {
  HotkeyAction,
  HotkeyReturnType,
  SplitterPosition,
} from "@/type/preload";
import { parseCombo, setHotkeyFunctions } from "@/store/setting";

export default defineComponent({
  name: "Home",

  components: {
    draggable,
    MenuBar,
    HeaderBar,
    AudioCell,
    AudioDetail,
    AudioInfo,
    HelpDialog,
    SettingDialog,
    HotkeySettingDialog,
    HeaderBarCustomDialog,
    CharacterPortrait,
    DefaultStyleSelectDialog,
    CharacterOrderDialog,
    AcceptRetrieveTelemetryDialog,
    AcceptTermsDialog,
    DictionaryManageDialog,
  },

  setup() {
    const store = useStore();
    const $q = useQuasar();

    const audioItems = computed(() => store.state.audioItems);
    const audioKeys = computed(() => store.state.audioKeys);
    const uiLocked = computed(() => store.getters.UI_LOCKED);

    // hotkeys handled by Mousetrap
    const hotkeyMap = new Map<HotkeyAction, () => HotkeyReturnType>([
      [
        "テキスト欄にフォーカスを戻す",
        () => {
          if (activeAudioKey.value !== undefined) {
            focusCell({ audioKey: activeAudioKey.value });
          }
          return false; // this is the same with event.preventDefault()
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

    const splitterPosition = computed<SplitterPosition>(
      () => store.state.splitterPosition
    );

    const updateSplitterPosition = async (
      propertyName: keyof SplitterPosition,
      newValue: number
    ) => {
      const newSplitterPosition = {
        ...splitterPosition.value,
        [propertyName]: newValue,
      };
      store.dispatch("SET_SPLITTER_POSITION", {
        splitterPosition: newSplitterPosition,
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

    // DaD
    const updateAudioKeys = (audioKeys: string[]) =>
      store.dispatch("COMMAND_SET_AUDIO_KEYS", { audioKeys });
    const itemKey = (key: string) => key;

    // セルを追加
    const activeAudioKey = computed<string | undefined>(
      () => store.getters.ACTIVE_AUDIO_KEY
    );
    const addAudioItem = async () => {
      const prevAudioKey = activeAudioKey.value;
      let styleId: number | undefined = undefined;
      let presetKey: string | undefined = undefined;
      if (prevAudioKey !== undefined) {
        styleId = store.state.audioItems[prevAudioKey].styleId;
        presetKey = store.state.audioItems[prevAudioKey].presetKey;
      }
      let audioItem: AudioItem;
      let baseAudioItem: AudioItem | undefined = undefined;
      if (store.state.inheritAudioInfo) {
        baseAudioItem = prevAudioKey
          ? store.state.audioItems[prevAudioKey]
          : undefined;
      }
      //パラメータ引き継ぎがONの場合は話速等のパラメータを引き継いでテキスト欄を作成する
      //パラメータ引き継ぎがOFFの場合、baseAudioItemがundefinedになっているのでパラメータ引き継ぎは行われない
      audioItem = await store.dispatch("GENERATE_AUDIO_ITEM", {
        styleId,
        presetKey,
        baseAudioItem,
      });

      const newAudioKey = await store.dispatch("COMMAND_REGISTER_AUDIO_ITEM", {
        audioItem,
        prevAudioKey: activeAudioKey.value,
      });
      audioCellRefs[newAudioKey].focusTextField();
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
          splitterPosition.value.portraitPaneWidth ??
            DEFAULT_PORTRAIT_PANE_WIDTH,
          MIN_PORTRAIT_PANE_WIDTH,
          MAX_PORTRAIT_PANE_WIDTH
        );

        audioInfoPaneWidth.value = clamp(
          splitterPosition.value.audioInfoPaneWidth ??
            MIN_AUDIO_INFO_PANE_WIDTH,
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
    const focusCell = ({ audioKey }: { audioKey: string }) => {
      audioCellRefs[audioKey].focusTextField();
    };

    // Electronのデフォルトのundo/redoを無効化
    const disableDefaultUndoRedo = (event: KeyboardEvent) => {
      // ctrl+z, ctrl+shift+z, ctrl+y
      if (
        event.ctrlKey &&
        (event.key == "z" || (!event.shiftKey && event.key == "y"))
      ) {
        event.preventDefault();
      }
    };

    // ソフトウェアを初期化
    const isCompletedInitialStartup = ref(false);
    onMounted(async () => {
      await store.dispatch("GET_ENGINE_INFOS");

      await store.dispatch("START_WAITING_ENGINE_ALL");
      await store.dispatch("LOAD_CHARACTER");
      await store.dispatch("LOAD_USER_CHARACTER_ORDER");
      await store.dispatch("LOAD_DEFAULT_STYLE_IDS");

      // 新キャラが追加されている場合はキャラ並び替えダイアログを表示
      const newCharacters = await store.dispatch("GET_NEW_CHARACTERS");
      isCharacterOrderDialogOpenComputed.value = newCharacters.length > 0;

      // スタイルが複数あって未選択なキャラがいる場合はデフォルトスタイル選択ダイアログを表示
      let isUnsetDefaultStyleIds = false;
      if (characterInfos.value == undefined) throw new Error();
      for (const info of characterInfos.value) {
        isUnsetDefaultStyleIds ||=
          info.metas.styles.length > 1 &&
          (await store.dispatch("IS_UNSET_DEFAULT_STYLE_ID", {
            speakerUuid: info.metas.speakerUuid,
          }));
      }
      isDefaultStyleSelectDialogOpenComputed.value = isUnsetDefaultStyleIds;

      // 最初のAudioCellを作成
      const audioItem: AudioItem = await store.dispatch(
        "GENERATE_AUDIO_ITEM",
        {}
      );
      const newAudioKey = await store.dispatch("REGISTER_AUDIO_ITEM", {
        audioItem,
      });
      focusCell({ audioKey: newAudioKey });

      // 最初の話者を初期化
      if (audioItem.styleId != undefined) {
        store.dispatch("SETUP_ENGINE_SPEAKER", { styleId: audioItem.styleId });
      }

      // ショートカットキーの設定
      document.addEventListener("keydown", disableDefaultUndoRedo);

      hotkeyActionsNative.forEach((item) => {
        document.addEventListener("keyup", item);
      });

      isAcceptRetrieveTelemetryDialogOpenComputed.value =
        store.state.acceptRetrieveTelemetry === "Unconfirmed";

      isAcceptTermsDialogOpenComputed.value =
        process.env.NODE_ENV == "production" &&
        store.state.acceptTerms !== "Accepted";

      isCompletedInitialStartup.value = true;
    });

    // エンジン待機
    // TODO: 個別のエンジンの状態をUIで確認できるようにする
    const allEngineState = computed(() => {
      const engineStates = store.state.engineStates;

      let lastEngineState: EngineState | undefined = undefined;

      // 登録されているすべてのエンジンについて状態を確認する
      for (const engineId of store.state.engineIds) {
        const engineState: EngineState | undefined = engineStates[engineId];
        if (engineState === undefined)
          throw new Error(`No such engineState set: engineId == ${engineId}`);

        // FIXME: 1つでも接続テストに成功していないエンジンがあれば、暫定的に起動中とする
        if (engineState === "STARTING") {
          return engineState;
        }

        lastEngineState = engineState;
      }

      return lastEngineState; // FIXME: 暫定的に1つのエンジンの状態を返す
    });

    // ライセンス表示
    const isHelpDialogOpenComputed = computed({
      get: () => store.state.isHelpDialogOpen,
      set: (val) =>
        store.dispatch("IS_HELP_DIALOG_OPEN", { isHelpDialogOpen: val }),
    });

    // 設定
    const isSettingDialogOpenComputed = computed({
      get: () => store.state.isSettingDialogOpen,
      set: (val) =>
        store.dispatch("IS_SETTING_DIALOG_OPEN", { isSettingDialogOpen: val }),
    });

    // ショートカットキー設定
    const isHotkeySettingDialogOpenComputed = computed({
      get: () => store.state.isHotkeySettingDialogOpen,
      set: (val) =>
        store.dispatch("IS_HOTKEY_SETTING_DIALOG_OPEN", {
          isHotkeySettingDialogOpen: val,
        }),
    });

    // ツールバーのカスタム設定
    const isToolbarSettingDialogOpenComputed = computed({
      get: () => store.state.isToolbarSettingDialogOpen,
      set: (val) =>
        store.dispatch("IS_TOOLBAR_SETTING_DIALOG_OPEN", {
          isToolbarSettingDialogOpen: val,
        }),
    });

    // 利用規約表示
    const isAcceptTermsDialogOpenComputed = computed({
      get: () => store.state.isAcceptTermsDialogOpen,
      set: (val) =>
        store.dispatch("IS_ACCEPT_TERMS_DIALOG_OPEN", {
          isAcceptTermsDialogOpen: val,
        }),
    });

    // キャラクター並び替え
    const characterInfos = computed(() => store.state.characterInfos);
    const isCharacterOrderDialogOpenComputed = computed({
      get: () =>
        !store.state.isAcceptTermsDialogOpen &&
        store.state.isCharacterOrderDialogOpen,
      set: (val) =>
        store.dispatch("IS_CHARACTER_ORDER_DIALOG_OPEN", {
          isCharacterOrderDialogOpen: val,
        }),
    });

    // デフォルトスタイル選択
    const isDefaultStyleSelectDialogOpenComputed = computed({
      get: () =>
        !store.state.isAcceptTermsDialogOpen &&
        !store.state.isCharacterOrderDialogOpen &&
        store.state.isDefaultStyleSelectDialogOpen,
      set: (val) =>
        store.dispatch("IS_DEFAULT_STYLE_SELECT_DIALOG_OPEN", {
          isDefaultStyleSelectDialogOpen: val,
        }),
    });

    // 読み方＆アクセント辞書
    const isDictionaryManageDialogOpenComputed = computed({
      get: () => store.state.isDictionaryManageDialogOpen,
      set: (val) =>
        store.dispatch("IS_DICTIONARY_MANAGE_DIALOG_OPEN", {
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
        store.dispatch("IS_ACCEPT_RETRIEVE_TELEMETRY_DIALOG_OPEN", {
          isAcceptRetrieveTelemetryDialogOpen: val,
        }),
    });

    // ドラッグ＆ドロップ
    const dragEventCounter = ref(0);
    const loadDraggedFile = (event?: { dataTransfer: DataTransfer }) => {
      if (!event || event.dataTransfer.files.length === 0) return;
      const file = event.dataTransfer.files[0];
      switch (path.extname(file.name)) {
        case ".txt":
          store.dispatch("COMMAND_IMPORT_FROM_FILE", { filePath: file.path });
          break;
        case ".vvproj":
          store.dispatch("LOAD_PROJECT_FILE", { filePath: file.path });
          break;
        default:
          $q.dialog({
            title: "対応していないファイルです",
            message:
              "テキストファイル (.txt) とVOICEVOXプロジェクトファイル (.vvproj) に対応しています。",
            ok: {
              label: "閉じる",
              flat: true,
              textColor: "display",
            },
          });
      }
    };

    return {
      audioItems,
      audioKeys,
      uiLocked,
      addAudioCellRef,
      activeAudioKey,
      itemKey,
      updateAudioKeys,
      addAudioItem,
      shouldShowPanes,
      focusCell,
      changeAudioDetailPaneMaxHeight,
      resizeObserverRef,
      MIN_PORTRAIT_PANE_WIDTH,
      MAX_PORTRAIT_PANE_WIDTH,
      portraitPaneWidth,
      audioInfoPaneWidth,
      audioInfoPaneMinWidth,
      audioInfoPaneMaxWidth,
      audioDetailPaneHeight,
      audioDetailPaneMinHeight,
      audioDetailPaneMaxHeight,
      updatePortraitPane,
      updateAudioInfoPane,
      updateAudioDetailPane,
      isCompletedInitialStartup,
      allEngineState,
      isHelpDialogOpenComputed,
      isSettingDialogOpenComputed,
      isHotkeySettingDialogOpenComputed,
      isToolbarSettingDialogOpenComputed,
      characterInfos,
      isCharacterOrderDialogOpenComputed,
      isDefaultStyleSelectDialogOpenComputed,
      isDictionaryManageDialogOpenComputed,
      isAcceptRetrieveTelemetryDialogOpenComputed,
      isAcceptTermsDialogOpenComputed,
      dragEventCounter,
      loadDraggedFile,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-header {
  height: vars.$header-height;
}

.waiting-engine {
  background-color: rgba(colors.$display-dark-rgb, 0.15);
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  text-align: center;
  align-items: center;
  justify-content: center;

  > div {
    color: colors.$display;
    background: colors.$setting-item;
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
  background-color: rgba(colors.$display-dark-rgb, 0.15);
}

.audio-cell-pane {
  flex-grow: 1;
  flex-shrink: 1;
  flex-basis: 0;

  position: relative;
  height: 100%;

  &.is-dragging {
    background-color: rgba(colors.$display-dark-rgb, 0.15);
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
  background: colors.$header-background !important; // bg-primaryも!importantでゴリ押してるので許される
}
</style>
