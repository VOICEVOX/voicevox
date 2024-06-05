<template>
  <QDialog
    v-model="engineManageDialogOpenedComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout container view="hHh Lpr fFf" class="bg-background">
      <QPageContainer>
        <QHeader class="q-pa-sm">
          <QToolbar>
            <QToolbarTitle class="text-display">エンジンの管理</QToolbarTitle>
            <QSpace />
            <!-- close button -->
            <QBtn
              round
              flat
              icon="close"
              color="display"
              :disabled="isAddingEngine || uiLocked"
              @click="toDialogClosedState"
            />
          </QToolbar>
        </QHeader>
        <QPage class="row">
          <div v-if="uiLockedState" class="ui-lock-popup">
            <div class="q-pa-md">
              <QSpinner color="primary" size="2.5rem" />
              <div class="q-mt-xs">
                <template v-if="uiLockedState === 'addingEngine'"
                  >追加中・・・</template
                >
                <template v-if="uiLockedState === 'deletingEngine'"
                  >削除中・・・</template
                >
              </div>
            </div>
          </div>
          <div class="col-4 engine-list-col">
            <div v-if="isAddingEngine" class="engine-list-disable-overlay" />
            <div class="engine-list-header text-no-wrap">
              <div class="row engine-list-title text-h5">エンジン一覧</div>
              <div class="row no-wrap">
                <QBtn
                  outline
                  textColor="display"
                  class="text-no-wrap text-bold col-sm q-ma-sm"
                  :disable="uiLocked"
                  @click="toAddEngineState"
                  >追加</QBtn
                >
              </div>
            </div>
            <QList class="engine-list">
              <template
                v-for="([type, engineIds], i) in Object.entries(
                  categorizedEngineIds,
                )"
                :key="`engine-list-${i}`"
              >
                <QSeparator v-if="i > 0" spaced />
                <QItemLabel header> {{ getEngineTypeName(type) }}</QItemLabel>
                <QItem
                  v-for="id in engineIds"
                  :key="id"
                  v-ripple
                  tag="label"
                  clickable
                  :active="selectedId === id"
                  activeClass="active-engine"
                  @click="selectEngine(id)"
                >
                  <QItemSection avatar>
                    <QAvatar rounded color="primary">
                      <img
                        v-if="engineIcons[id]"
                        :src="engineIcons[id]"
                        :alt="engineInfos[id].name"
                      />
                      <span v-else class="text-display-on-primary"> ? </span>
                    </QAvatar>
                  </QItemSection>
                  <QItemSection>
                    <QItemLabel class="text-display">{{
                      engineInfos[id].name
                    }}</QItemLabel>
                    <QItemLabel caption class="engine-path">{{
                      engineManifests[id] != undefined
                        ? engineManifests[id].brandName
                        : engineInfos[id].uuid
                    }}</QItemLabel>
                  </QItemSection>
                </QItem>
              </template>
            </QList>
          </div>

          <!-- 右側のpane -->
          <div
            v-if="isAddingEngine"
            class="col-8 no-wrap text-no-wrap engine-detail"
          >
            <div class="q-pl-md q-mt-md">
              <div class="text-h5 q-ma-sm">エンジンの追加</div>

              <div class="q-ma-sm">
                <QBtnToggle
                  v-model="engineLoaderType"
                  :options="[
                    { value: 'vvpp', label: 'VVPPファイル' },
                    { value: 'dir', label: '既存エンジン' },
                  ]"
                  color="surface"
                  unelevated
                  textColor="display"
                  toggleColor="primary"
                  toggleTextColor="display-on-primary"
                />
              </div>
            </div>

            <div v-if="engineLoaderType === 'vvpp'" class="no-wrap q-pl-md">
              <div class="q-ma-sm">
                VVPPファイルでエンジンをインストールします。
              </div>
              <div class="q-ma-sm">
                <QInput
                  ref="vvppFilePathInput"
                  v-model="vvppFilePath"
                  dense
                  readonly
                  placeholder="VVPPファイルの場所"
                  @click="selectVvppFile"
                >
                  <template #append>
                    <QBtn
                      square
                      dense
                      flat
                      color="primary"
                      icon="folder_open"
                      @click="selectVvppFile"
                    >
                      <QTooltip :delay="500" anchor="bottom left">
                        ファイル選択
                      </QTooltip>
                    </QBtn>
                  </template>
                  <template #error>
                    {{
                      newEngineDirValidationState
                        ? getEngineDirValidationMessage(
                            newEngineDirValidationState,
                          )
                        : undefined
                    }}
                  </template>
                </QInput>
              </div>
            </div>
            <div v-if="engineLoaderType === 'dir'" class="no-wrap q-pl-md">
              <div class="q-ma-sm">PC内にあるエンジンを追加します。</div>
              <div class="q-ma-sm">
                <QInput
                  ref="newEngineDirInput"
                  v-model="newEngineDir"
                  dense
                  readonly
                  :error="
                    newEngineDirValidationState != undefined &&
                    newEngineDirValidationState !== 'ok'
                  "
                  placeholder="エンジンフォルダの場所"
                  @click="selectEngineDir"
                >
                  <template #append>
                    <QBtn
                      square
                      dense
                      flat
                      color="primary"
                      icon="folder_open"
                      @click="selectEngineDir"
                    >
                      <QTooltip :delay="500" anchor="bottom left">
                        フォルダ選択
                      </QTooltip>
                    </QBtn>
                  </template>
                  <template #error>
                    {{
                      newEngineDirValidationState
                        ? getEngineDirValidationMessage(
                            newEngineDirValidationState,
                          )
                        : undefined
                    }}
                  </template>
                </QInput>
              </div>
            </div>
            <div class="row q-px-md right-pane-buttons">
              <QSpace />

              <QBtn
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                @click="toInitialState"
                >キャンセル</QBtn
              >
              <QBtn
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disabled="!canAddEngine"
                @click="addEngine"
                >追加</QBtn
              >
            </div>
          </div>
          <div
            v-else-if="selectedId"
            class="col-8 no-wrap text-no-wrap engine-detail"
          >
            <div class="q-pl-md q-mt-md flex">
              <img
                v-if="selectedId in engineIcons"
                :src="engineIcons[selectedId]"
                :alt="engineInfos[selectedId].name"
                class="engine-icon"
              />
              <div v-else class="q-mt-sm inline-block">
                <QAvatar rounded color="primary" size="2rem">
                  <span class="text-display-on-primary"> ? </span>
                </QAvatar>
              </div>
              <div class="text-h5 q-ma-sm">
                {{ engineInfos[selectedId].name }}
              </div>
            </div>

            <div class="no-wrap q-pl-md">
              <ul>
                <li>
                  バージョン：{{
                    engineVersions[selectedId]
                      ? engineVersions[selectedId]
                      : "（取得に失敗しました）"
                  }}
                </li>
                <li>
                  URL：
                  <a
                    v-if="engineManifests[selectedId]"
                    :href="engineManifests[selectedId].url"
                    class="text-display-hyperlink"
                    target="_blank"
                    >{{ engineManifests[selectedId].url }}</a
                  >
                  <span v-else>（取得に失敗しました）</span>
                </li>
              </ul>
            </div>
            <div class="no-wrap q-pl-md">
              <div class="text-h6 q-ma-sm">機能</div>
              <ul
                v-if="
                  engineManifests[selectedId] &&
                  engineManifests[selectedId].supportedFeatures
                "
              >
                <template
                  v-for="(value, feature) in engineManifests[selectedId]
                    .supportedFeatures != null
                    ? engineManifests[selectedId].supportedFeatures
                    : null"
                  :key="feature"
                >
                  <!-- TODO: vvlib機能がリリースされたらmanageLibraryも表示するようにする -->
                  <li
                    v-if="feature != 'manageLibrary'"
                    :class="value ? '' : 'text-warning'"
                  >
                    {{ getFeatureName(feature) }}：{{
                      value ? "対応" : "非対応"
                    }}
                  </li>
                </template>
              </ul>
              <span v-else>（取得に失敗しました）</span>
            </div>
            <div class="no-wrap q-pl-md">
              <div class="text-h6 q-ma-sm">場所</div>
              <div
                :class="
                  'q-ma-sm' + (engineInfos[selectedId].path ? '' : ' disabled')
                "
              >
                <QInput
                  ref="pathInput"
                  v-model="engineDir"
                  disabled
                  dense
                  readonly
                />
              </div>
            </div>
            <div class="row q-px-md right-pane-buttons">
              <QSpace />

              <QBtn
                outline
                textColor="warning"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="
                  uiLocked ||
                  !['path', 'vvpp'].includes(engineInfos[selectedId].type)
                "
                @click="deleteEngine"
                >削除</QBtn
              >
              <QBtn
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || !engineInfos[selectedId].path"
                @click="openSelectedEngineDirectory"
                >フォルダを開く</QBtn
              >
              <QBtn
                outline
                textColor="display"
                class="text-no-wrap text-bold q-mr-sm"
                :disable="uiLocked || engineStates[selectedId] === 'STARTING'"
                @click="restartSelectedEngine"
                >再起動</QBtn
              >
            </div>
          </div>
        </QPage>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useStore } from "@/store";
import { EngineDirValidationResult, EngineId } from "@/type/preload";
import type { SupportedFeatures } from "@/openapi/models/SupportedFeatures";
import { useEngineIcons } from "@/composables/useEngineIcons";

type EngineLoaderType = "dir" | "vvpp";

const props = defineProps<{
  modelValue: boolean;
}>();
const emit = defineEmits<{
  (e: "update:modelValue", val: boolean): void;
}>();

const store = useStore();

const engineManageDialogOpenedComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});
const uiLockedState = ref<null | "addingEngine" | "deletingEngine">(null); // ダイアログ内でstore.getters.UI_LOCKEDは常にtrueなので独自に管理
const uiLocked = computed(() => uiLockedState.value != null);
const isAddingEngine = ref(false);
const engineLoaderType = ref<EngineLoaderType>("vvpp");

const lockUi = function <T>(
  lockType: "addingEngine" | "deletingEngine",
  action: Promise<T>,
): Promise<T> {
  uiLockedState.value = lockType;
  return action.finally(() => {
    uiLockedState.value = null;
  });
};

const categorizedEngineIds = computed(() => {
  const sortedEngineInfos = store.getters.GET_SORTED_ENGINE_INFOS;
  const result = {
    default: Object.values(sortedEngineInfos)
      .filter((info) => info.type === "default")
      .map((info) => info.uuid),
    plugin: Object.values(sortedEngineInfos)
      .filter((info) => info.type === "path" || info.type === "vvpp")
      .map((info) => info.uuid),
  };
  return Object.fromEntries(
    Object.entries(result).filter(([, ids]) => ids.length > 0),
  );
});
const engineInfos = computed(() => store.state.engineInfos);
const engineStates = computed(() => store.state.engineStates);

const engineIcons = useEngineIcons(() => store.state.engineManifests);
const engineManifests = computed(() => store.state.engineManifests);
const engineVersions = ref<Record<EngineId, string>>({});

watch(
  [engineInfos, engineStates, engineManifests],
  async () => {
    // FIXME: engineInfosをMapにする
    for (const idStr of Object.keys(engineInfos.value)) {
      const id = EngineId(idStr);
      if (engineStates.value[id] !== "READY") continue;
      if (engineVersions.value[id]) continue;
      const version = await store
        .dispatch("INSTANTIATE_ENGINE_CONNECTOR", { engineId: id })
        .then((instance) => instance.invoke("versionVersionGet")({}))
        .then((version) => {
          // OpenAPIのバグで"latest"のようにダブルクォーテーションで囲まれていることがあるので外す
          if (version.startsWith('"') && version.endsWith('"')) {
            return version.slice(1, -1);
          }
          return version;
        })
        .catch(() => null);
      if (!version) continue;
      engineVersions.value = {
        ...engineVersions.value,
        [id]: version,
      };
    }
  },
  { immediate: true },
);

const selectedId = ref<EngineId | undefined>(undefined);

const engineDir = computed(() => {
  if (selectedId.value == undefined) throw new Error("engine is not selected");
  return engineInfos.value[selectedId.value]?.path || "（組み込み）";
});

const getEngineTypeName = (name: string) => {
  const engineTypeMap = {
    default: "デフォルトエンジン",
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
    synthesisMorphing: "2種類のスタイルでモーフィングした音声を合成",
    sing: "歌唱音声合成",
    manageLibrary: "音声ライブラリ(vvlib)の管理",
  };
  return featureNameMap[name];
};

const getEngineDirValidationMessage = (result: EngineDirValidationResult) => {
  const messageMap: {
    [key in EngineDirValidationResult]: string | undefined;
  } = {
    directoryNotFound: "フォルダが見つかりませんでした。",
    notADirectory: "フォルダではありません。",
    manifestNotFound: "engine_manifest.jsonが見つかりませんでした。",
    invalidManifest: "engine_manifest.jsonの内容が不正です。",
    alreadyExists: "同じIDのエンジンが既に登録されています。",
    ok: undefined,
  };
  return messageMap[result];
};

const addEngine = async () => {
  const result = await store.dispatch("SHOW_WARNING_DIALOG", {
    title: "エンジン追加の確認",
    message:
      "この操作はコンピュータに損害を与える可能性があります。エンジンの配布元が信頼できない場合は追加しないでください。",
    actionName: "追加",
  });
  if (result === "OK") {
    if (engineLoaderType.value === "dir") {
      await lockUi(
        "addingEngine",
        store.dispatch("ADD_ENGINE_DIR", {
          engineDir: newEngineDir.value,
        }),
      );

      requireReload(
        "エンジンを追加しました。反映には再読み込みが必要です。今すぐ再読み込みしますか？",
      );
    } else {
      const success = await lockUi(
        "addingEngine",
        store.dispatch("INSTALL_VVPP_ENGINE", vvppFilePath.value),
      );
      if (success) {
        requireReload(
          "エンジンを追加しました。反映には再読み込みが必要です。今すぐ再読み込みしますか？",
        );
      }
    }
  }
};
const deleteEngine = async () => {
  const result = await store.dispatch("SHOW_CONFIRM_DIALOG", {
    title: "エンジン削除の確認",
    message: "選択中のエンジンを削除します。よろしいですか？",
    actionName: "削除",
  });
  if (result === "OK") {
    if (selectedId.value == undefined)
      throw new Error("engine is not selected");
    switch (engineInfos.value[selectedId.value].type) {
      case "path": {
        const engineDir = store.state.engineInfos[selectedId.value].path;
        if (!engineDir)
          throw new Error("assert engineInfos[selectedId.value].path");
        await lockUi(
          "deletingEngine",
          store.dispatch("REMOVE_ENGINE_DIR", {
            engineDir,
          }),
        );
        requireReload(
          "エンジンを削除しました。反映には再読み込みが必要です。今すぐ再読み込みしますか？",
        );
        break;
      }
      case "vvpp": {
        const success = await lockUi(
          "deletingEngine",
          store.dispatch("UNINSTALL_VVPP_ENGINE", selectedId.value),
        );
        if (success) {
          requireReload(
            "エンジンの削除には再読み込みが必要です。今すぐ再読み込みしますか？",
          );
        }
        break;
      }
      default:
        throw new Error("assert engineInfos[selectedId.value].type");
    }
  }
};

const selectEngine = (id: EngineId) => {
  selectedId.value = id;
};

const openSelectedEngineDirectory = () => {
  if (selectedId.value == undefined)
    throw new Error("assert selectedId.value != undefined");
  store.dispatch("OPEN_ENGINE_DIRECTORY", { engineId: selectedId.value });
};

const restartSelectedEngine = () => {
  if (selectedId.value == undefined)
    throw new Error("assert selectedId.value != undefined");
  store.dispatch("RESTART_ENGINES", {
    engineIds: [selectedId.value],
  });
};

const requireReload = async (message: string) => {
  const result = await store.dispatch("SHOW_WARNING_DIALOG", {
    title: "再読み込みが必要です",
    message: message,
    actionName: "再読み込み",
    cancel: "後で",
  });
  toInitialState();
  if (result === "OK") {
    store.dispatch("CHECK_EDITED_AND_NOT_SAVE", {
      closeOrReload: "reload",
    });
  }
};

const newEngineDir = ref("");
const newEngineDirValidationState = ref<EngineDirValidationResult | null>(null);
const selectEngineDir = async () => {
  const path = await window.backend.showOpenDirectoryDialog({
    title: "エンジンのフォルダを選択",
  });
  if (path) {
    newEngineDir.value = path;
    if (path === "") {
      newEngineDirValidationState.value = null;
      return;
    }
    newEngineDirValidationState.value = await store.dispatch(
      "VALIDATE_ENGINE_DIR",
      {
        engineDir: path,
      },
    );
  }
};

const vvppFilePath = ref("");
const selectVvppFile = async () => {
  const path = await window.backend.showVvppOpenDialog({
    title: "vvppファイルを選択",
    defaultPath: vvppFilePath.value,
  });
  if (path) {
    vvppFilePath.value = path;
  }
};

const canAddEngine = computed(() => {
  if (uiLocked.value) return false;
  if (engineLoaderType.value === "dir") {
    return (
      newEngineDir.value !== "" && newEngineDirValidationState.value === "ok"
    );
  } else if (engineLoaderType.value === "vvpp") {
    return vvppFilePath.value !== "";
  } else {
    return false;
  }
});

// ステートの移動
// 初期状態
const toInitialState = () => {
  selectedId.value = undefined;
  isAddingEngine.value = false;
};
// エンジン追加状態
const toAddEngineState = () => {
  isAddingEngine.value = true;
  selectedId.value = undefined;
  newEngineDirValidationState.value = null;
  newEngineDir.value = "";
  vvppFilePath.value = "";
};
// ダイアログが閉じている状態
const toDialogClosedState = () => {
  engineManageDialogOpenedComputed.value = false;
  isAddingEngine.value = false;
};
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as colors;
@use "@/styles/variables" as vars;

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
  // menubar-height + toolbar-height + window-border-width +
  // 82(title & buttons) + 30(margin 15x2)
  height: calc(
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
      vars.$window-border-width + 82px + 30px}
  );
  width: 100%;
  overflow-y: auto;
}

.engine-path {
  overflow-wrap: break-word;
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
    100vh - #{vars.$menubar-height + vars.$toolbar-height +
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

.ui-lock-popup {
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
  }
}
</style>
