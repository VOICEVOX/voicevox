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
              :disabled="isAddingEngine"
            />
          </q-toolbar>
        </q-header>
        <q-page class="row">
          <div class="col-4 engine-list-col">
            <div v-if="isAddingEngine" class="engine-list-disable-overlay" />
            <div class="engine-list-header text-no-wrap">
              <div class="row engine-list-title text-h5">エンジン一覧</div>
              <div class="row no-wrap">
                <q-btn
                  outline
                  text-color="display"
                  class="text-no-wrap text-bold col-sm q-ma-sm"
                  @click="toAddEngineState"
                  :disable="uiLocked"
                  >追加</q-btn
                >
              </div>
            </div>
            <q-list class="engine-list">
              <template
                v-for="([type, engineIds], i) in Object.entries(
                  categorizedEngineIds
                )"
                :key="`engine-list-${i}`"
              >
                <q-separator v-if="i > 0" spaced />
                <q-item-label header>
                  {{ getEngineTypeName(type) }}</q-item-label
                >
                <q-item
                  v-for="id in engineIds"
                  :key="id"
                  tag="label"
                  v-ripple
                  clickable
                  @click="selectEngine(id)"
                  :active="selectedId === id"
                  active-class="active-engine"
                >
                  <q-item-section avatar>
                    <q-avatar rounded>
                      <img :src="engineIcons[id]" :alt="engineInfos[id].name" />
                    </q-avatar>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label class="text-display">{{
                      engineInfos[id].name
                    }}</q-item-label>
                    <q-item-label caption v-if="engineInfos[id].path">{{
                      engineInfos[id].path
                    }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-list>
          </div>

          <!-- 右側のpane -->
          <div
            v-if="isAddingEngine"
            class="col-8 no-wrap text-no-wrap engine-detail"
          >
            <div class="q-pl-md q-mt-md">
              <div class="text-h5 q-ma-sm">エンジンの追加</div>
            </div>

            <div class="no-wrap q-pl-md">
              <div class="text-h6 q-ma-sm">場所</div>
              <div class="q-ma-sm">
                <q-input
                  ref="newEnginePathInput"
                  v-model="newEnginePath"
                  dense
                  :error="
                    newEnginePathValidationState &&
                    newEnginePathValidationState !== 'ok'
                  "
                >
                  <template v-slot:append>
                    <q-btn
                      square
                      dense
                      flat
                      color="primary"
                      icon="folder_open"
                      @click="openFileExplore"
                    >
                      <q-tooltip :delay="500" anchor="bottom left">
                        フォルダ選択
                      </q-tooltip>
                    </q-btn>
                  </template>
                  <template v-slot:error>
                    {{ getValidationMessage(newEnginePathValidationState) }}
                  </template>
                </q-input>
              </div>
            </div>
            <div class="row q-px-md right-pane-buttons">
              <q-space />

              <q-btn
                outline
                text-color="warning"
                class="text-no-wrap text-bold q-mr-sm"
                @click="toInitialState"
                >キャンセル</q-btn
              >
              <q-btn
                outline
                text-color="display"
                class="text-no-wrap text-bold q-mr-sm"
                @click="addEngine"
                :disabled="newEnginePathValidationState !== 'ok'"
                >追加</q-btn
              >
            </div>
          </div>
          <div
            v-else-if="selectedId"
            class="col-8 no-wrap text-no-wrap engine-detail"
          >
            <div class="q-pl-md q-mt-md flex">
              <img
                :src="engineIcons[selectedId]"
                :alt="engineInfos[selectedId].name"
                class="engine-icon"
              />
              <div class="text-h5 q-ma-sm">
                {{ engineInfos[selectedId].name }}
              </div>
            </div>

            <div class="no-wrap q-pl-md">
              <ul>
                <li>バージョン：{{ engineVersions[selectedId] }}</li>
                <li>
                  URL：<a
                    :href="engineManifests[selectedId].url"
                    class="text-display-hyperlink"
                    target="_blank"
                    >{{ engineManifests[selectedId].url }}</a
                  >
                </li>
              </ul>
            </div>
            <div class="no-wrap q-pl-md">
              <div class="text-h6 q-ma-sm">機能</div>
              <ul>
                <li
                  v-for="[feature, value] in Object.entries(
                    engineManifests[selectedId].supportedFeatures
                  )"
                  :key="feature"
                  :class="value ? '' : 'text-warning'"
                >
                  {{ getFeatureName(feature) }}：{{ value ? "対応" : "非対応" }}
                </li>
              </ul>
            </div>
            <div class="no-wrap q-pl-md">
              <div class="text-h6 q-ma-sm">場所</div>
              <div
                :class="
                  'q-ma-sm' + (engineInfos[selectedId].path ? '' : ' disabled')
                "
              >
                <q-input
                  ref="pathInput"
                  v-model="enginePath"
                  disabled
                  dense
                  readonly
                />
              </div>
            </div>
            <div class="row q-px-md right-pane-buttons">
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
import { base64ImageToUri } from "@/helpers/imageHelper";
import type { EnginePathValidationResult } from "@/type/preload";
import type { SupportedFeatures } from "@/openapi/models/SupportedFeatures";

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
    const isAddingEngine = ref(false);

    const categorizedEngineIds = computed(() => {
      const result = {
        main: Object.values(engineInfos.value)
          .filter((info) => info.type === "main")
          .map((info) => info.uuid),
        sub: Object.values(engineInfos.value)
          .filter((info) => info.type === "sub")
          .map((info) => info.uuid),
        plugin: Object.values(engineInfos.value)
          .filter((info) => info.type === "userDir" || info.type === "path")
          .map((info) => info.uuid),
      };
      return Object.fromEntries(
        Object.entries(result).filter(([, ids]) => ids.length > 0)
      );
    });
    const engineInfos = computed(() => store.state.engineInfos);
    const engineStates = computed(() => store.state.engineStates);
    const engineManifests = computed(() => store.state.engineManifests);
    const engineIcons = computed(() =>
      Object.fromEntries(
        Object.entries(store.state.engineManifests).map(([id, manifest]) => [
          id,
          base64ImageToUri(manifest.icon),
        ])
      )
    );
    const engineVersions = ref<Record<string, string>>({});

    watch(
      [engineInfos],
      async () => {
        for (const id of Object.keys(engineInfos.value)) {
          if (engineVersions.value[id]) return;
          const version = await store
            .dispatch("INSTANTIATE_ENGINE_CONNECTOR", { engineId: id })
            .then((instance) => instance.invoke("versionVersionGet")({}));
          // "latest"のようにダブルクォーテーションで囲まれているので、JSON.parseで外す。
          engineVersions.value[id] = JSON.parse(version);
        }
      },
      { immediate: true }
    );

    const selectedId = ref("");
    const isDeletable = computed(() => {
      return (
        engineInfos.value[selectedId.value] &&
        engineInfos.value[selectedId.value].type === "path"
      );
    });
    const enginePath = computed(() => {
      return engineInfos.value[selectedId.value]?.path || "（組み込み）";
    });

    const getEngineTypeName = (name: string) => {
      const engineTypeMap = {
        main: "メインエンジン",
        sub: "サブエンジン",
        plugin: "追加エンジン",
      };
      return engineTypeMap[name as keyof typeof engineTypeMap];
    };

    const getFeatureName = (name: keyof SupportedFeatures) => {
      const featureNameMap: { [key in keyof SupportedFeatures]: string } = {
        adjustMoraPitch: "モーラごとの音高の調整",
        adjustPhonemeLength: "音素ごとの長さの調整",
        adjustSpeedScale: "全体の話速の調整",
        adjustPitchScale: "全体の音高の調整",
        adjustIntonationScale: "全体の抑揚の調整",
        adjustVolumeScale: "全体の音量の調整",
        interrogativeUpspeak: "疑問文の自動調整",
      };
      return featureNameMap[name];
    };

    const getValidationMessage = (result: EnginePathValidationResult) => {
      const messageMap: { [key in EnginePathValidationResult]: string } = {
        directoryNotFound: "フォルダが見つかりませんでした。",
        notADirectory: "フォルダではありません。",
        manifestNotFound: "engine_manifest.jsonが見つかりませんでした。",
        invalidManifest: "engine_manifest.jsonの内容が不正です。",
        ok: "// TypeScriptのエラー回避用、実際は表示されません。",
      };
      return messageMap[result];
    };

    const addEngine = () => {
      store.dispatch("ADD_ENGINE_PATH", {
        enginePath: newEnginePath.value,
      });

      requireRestart("エンジンを追加しました。");
    };
    const deleteEngine = () => {
      $q.dialog({
        title: "確認",
        message: "選択中のエンジンを削除します。よろしいですか？",
        cancel: {
          label: "キャンセル",
          color: "display",
          flat: true,
        },
        ok: {
          label: "削除",
          flat: true,
          textColor: "warning",
        },
      }).onOk(() => {
        const enginePath = store.state.engineInfos[selectedId.value].path;
        if (!enginePath)
          throw new Error("assert engineInfos[selectedId.value].path");
        store.dispatch("REMOVE_ENGINE_PATH", {
          enginePath,
        });

        requireRestart("エンジンを削除しました。");
      });
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

    const requireRestart = (message: string) => {
      $q.dialog({
        title: "再起動が必要です",
        message: message + "反映には再起動が必要です。今すぐ再起動しますか？",
        cancel: {
          label: "後で",
          color: "display",
          flat: true,
        },

        ok: {
          label: "再起動",
          flat: true,
          textColor: "warning",
        },
      })
        .onOk(() => {
          store.dispatch("RESTART_APP");
        })
        .onCancel(() => {
          toInitialState();
        });
    };

    const newEnginePath = ref("");
    const newEnginePathValidationState =
      ref<EnginePathValidationResult | null>(null);
    const openFileExplore = async () => {
      const path = await window.electron.showOpenDirectoryDialog({
        title: "エンジンのフォルダを選択",
      });
      if (path) {
        newEnginePath.value = path;
      }
    };
    watch(newEnginePath, async () => {
      if (newEnginePath.value === "") {
        newEnginePathValidationState.value = null;
        return;
      }
      newEnginePathValidationState.value = await store.dispatch(
        "VALIDATE_ENGINE_PATH",
        {
          enginePath: newEnginePath.value,
        }
      );
    });

    // ステートの移動
    // 初期状態
    const toInitialState = () => {
      selectedId.value = "";
      isAddingEngine.value = false;
    };
    // エンジン追加状態
    const toAddEngineState = () => {
      isAddingEngine.value = true;
      newEnginePathValidationState.value = null;
      newEnginePath.value = "";
    };
    // ダイアログが閉じている状態
    const toDialogClosedState = () => {
      engineManageDialogOpenedComputed.value = false;
      isAddingEngine.value = false;
    };

    return {
      engineManageDialogOpenedComputed,
      categorizedEngineIds,
      engineInfos,
      engineStates,
      engineManifests,
      engineIcons,
      engineVersions,
      selectEngine,
      addEngine,
      deleteEngine,
      isDeletable,
      getFeatureName,
      getEngineTypeName,
      getValidationMessage,
      uiLocked,
      isAddingEngine,
      selectedId,
      toInitialState,
      toAddEngineState,
      toDialogClosedState,
      openSelectedEngineDirectory,
      restartSelectedEngine,
      enginePath,
      newEnginePath,
      openFileExplore,
      newEnginePathValidationState,
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

.active-engine {
  background: rgba(colors.$primary-rgb, 0.4);
}

.engine-list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  width: 100%;
  height: 100%;
  position: absolute;
  z-index: 10;
}

.engine-detail {
  display: flex;
  flex-flow: column;
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  ) !important;
  overflow: auto;
}

.right-pane-buttons {
  padding: 20px;

  display: flex;
  flex: 1;
  align-items: flex-end;
}

.engine-icon {
  height: 2rem;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  border-radius: 5px;
}
</style>
