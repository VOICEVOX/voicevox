<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="setting-dialog transparent-backdrop"
    v-model="engineManageDialogOpenedComputed"
  >
    <q-layout container view="hHh Lpr fFf" class="bg-background">
      <q-page-container>
        <q-header class="q-pa-sm">
          <q-toolbar>
            <q-toolbar-title class="text-display"
              >エンジンの管理</q-toolbar-title
            >
            <q-space />
            <!-- close button -->
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="toDialogClosedState"
            />
          </q-toolbar>
        </q-header>
        <q-page class="row">
          <div class="col-4 engine-list-col">
            <div class="engine-list-header text-no-wrap">
              <div class="row engine-list-title text-h5">エンジン一覧</div>
              <div class="row no-wrap">
                <q-btn
                  outline
                  text-color="display"
                  class="text-no-wrap text-bold col-sm q-ma-sm"
                  @click="newEngine"
                  :disable="uiLocked"
                  >追加</q-btn
                >
              </div>
            </div>
            <q-list class="engine-list">
              <q-item
                v-for="info in engineInfos"
                :key="info.uuid"
                tag="label"
                v-ripple
                clickable
                @click="selectEngine(info.uuid)"
                :active="selectedId === info.uuid"
                active-class="active-engine"
              >
                <q-item-section>
                  <q-item-label class="text-display">{{
                    info.name
                  }}</q-item-label>
                  <q-item-label caption v-if="info.path">{{
                    info.path
                  }}</q-item-label>
                </q-item-section>
              </q-item>
            </q-list>
          </div>

          <!-- 右側のpane -->
          <div v-if="selectedId" class="col-8 no-wrap text-no-wrap word-editor">
            <div>
              <!-- Vueのバグでdivだとエラーが出る -->
              <div class="text-h5 q-ma-sm">
                {{ engineInfos[selectedId].name }}
              </div>
            </div>

            <div class="no-wrap">
              <div class="text-h6 q-ma-sm">機能</div>
              <ul>
                <li
                  v-for="[feature, value] in Object.entries(
                    engineManifests[selectedId].supportedFeatures
                  )"
                  :key="feature"
                  :class="value ? '' : 'text-warning'"
                >
                  {{ getFeatureName(feature) }}：{{ value ? "対応" : "未対応" }}
                </li>
              </ul>
            </div>
            <div class="no-wrap">
              <div class="text-h6 q-ma-sm">場所</div>
              <div class="q-ma-sm">
                {{ engineInfos[selectedId].path || "（組み込み）" }}
              </div>
            </div>
            <div class="row q-px-md save-delete-reset-buttons">
              <q-space />

              <q-btn
                outline
                text-color="warning"
                class="text-no-wrap text-bold q-mr-sm"
                @click="deleteEngine"
                :disable="uiLocked || engineInfos[selectedId].type !== 'path'"
                >削除</q-btn
              >
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                @click="openSelectedEngineDirectory"
                :disable="uiLocked || !engineInfos[selectedId].path"
                >フォルダを開く</q-btn
              >
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                @click="restartSelectedEngine"
                :disable="uiLocked || engineStates[selectedId] !== 'READY'"
                >再起動</q-btn
              >
            </div>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from "vue";
import { useStore } from "@/store";
import { useQuasar } from "quasar";
export default defineComponent({
  name: "EngineManageDialog",
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
  },

  setup(props, { emit }) {
    const store = useStore();
    const $q = useQuasar();

    const engineManageDialogOpenedComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });
    const uiLocked = ref(false); // ダイアログ内でstore.getters.UI_LOCKEDは常にtrueなので独自に管理

    const engineInfos = computed(() => store.state.engineInfos);
    const engineStates = computed(() => store.state.engineStates);
    const engineManifests = computed(() => store.state.engineManifests);

    const selectedId = ref("");
    const isDeletable = computed(() => {
      return (
        engineInfos.value[selectedId.value] &&
        engineInfos.value[selectedId.value].type === "path"
      );
    });

    const createUILockAction = function <T>(action: Promise<T>) {
      uiLocked.value = true;
      return action.finally(() => {
        uiLocked.value = false;
      });
    };

    const getFeatureName = (name: string) => {
      const featureNameMap = {
        adjustMoraPitch: "モーラごとの音高の調整",
        adjustPhonemeLength: "音素ごとの長さの調整",
        adjustSpeedScale: "全体の話速の調整",
        adjustPitchScale: "全体の音高の調整",
        adjustIntonationScale: "全体の抑揚の調整",
        adjustVolumeScale: "全体の音量の調整",
        interrogativeUpspeak: "疑問文の自動調整",
      };
      return featureNameMap[name as keyof typeof featureNameMap];
    };

    const newEngine = () => {
      // TODO
    };

    const deleteEngine = () => {
      // TODO
    };

    const selectEngine = (id: string) => {
      selectedId.value = id;
    };

    const openSelectedEngineDirectory = () => {
      store.dispatch("OPEN_ENGINE_DIRECTORY", { engineId: selectedId.value });
    };

    const restartSelectedEngine = () => {
      store.dispatch("RESTART_ENGINE", { engineId: selectedId.value });
    };

    // ステートの移動
    // 初期状態
    const toInitialState = () => {
      selectedId.value = "";
    };
    // ダイアログが閉じている状態
    const toDialogClosedState = () => {
      engineManageDialogOpenedComputed.value = false;
    };

    return {
      engineManageDialogOpenedComputed,
      engineInfos,
      engineStates,
      engineManifests,
      newEngine,
      selectEngine,
      deleteEngine,
      isDeletable,
      getFeatureName,
      uiLocked,
      selectedId,
      toDialogClosedState,
      openSelectedEngineDirectory,
      restartSelectedEngine,
    };
  },
});
</script>

<style lang="scss" scoped>
@use '@/styles/colors' as colors;
@use '@/styles/variables' as vars;

.engine-list-col {
  border-right: solid 1px colors.$surface;
  position: relative; // オーバーレイのため
  overflow-x: hidden;
}

.engine-list-header {
  margin: 1rem;

  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  .engine-list-title {
    flex-grow: 1;
  }
}

.engine-list {
  // menubar-height + header-height + window-border-width +
  // 82(title & buttons) + 30(margin 15x2)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width + 82px + 30px}
  );
  width: 100%;
  overflow-y: auto;
}

.active-word {
  background: rgba(colors.$primary-rgb, 0.4);
}

.loading-dict {
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
    background: colors.$background;
    border-radius: 6px;
    padding: 14px;
  }
}

.engine-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}

.word-editor {
  display: flex;
  flex-flow: column;
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  ) !important;
  overflow: auto;
}

.word-input {
  padding-left: 10px;
  width: calc(66vw - 80px);

  :deep(.q-field__control) {
    height: 2rem;
  }

  :deep(.q-placeholder) {
    padding: 0;
    font-size: 20px;
  }

  :deep(.q-field__after) {
    height: 2rem;
  }
}

.desc-row {
  color: rgba(colors.$display-rgb, 0.5);
  font-size: 12px;
}

.play-button {
  margin: auto 0;
  padding-right: 16px;
}

.accent-phrase-table {
  flex-grow: 1;
  align-self: stretch;

  display: flex;
  height: 130px;
  overflow-x: scroll;
  width: calc(66vw - 140px);

  .mora-table {
    display: inline-grid;
    align-self: stretch;
    grid-template-rows: 1fr 60px 30px;

    .text-cell {
      padding: 0;
      min-width: 20px;
      max-width: 20px;
      grid-row-start: 3;
      text-align: center;
      white-space: nowrap;
      color: colors.$display;
      position: relative;
    }

    .splitter-cell {
      min-width: 20px;
      max-width: 20px;
      grid-row: 3 / span 1;
      z-index: vars.$detail-view-splitter-cell-z-index;
    }
  }
}

.save-delete-reset-buttons {
  padding: 20px;

  display: flex;
  flex: 1;
  align-items: flex-end;
}
</style>
