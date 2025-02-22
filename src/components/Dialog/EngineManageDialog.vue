<template>
  <QDialog
    v-model="engineManageDialogOpenedComputed"
    maximized
    transitionShow="jump-up"
    transitionHide="jump-down"
    class="setting-dialog transparent-backdrop"
  >
    <QLayout>
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
        <BaseNavigationView>
          <template #sidebar>
            <div v-if="isAddingEngine" class="list-disable-overlay" />
            <div class="list-header">
              <div class="list-title">エンジン一覧</div>
              <BaseButton
                label="追加"
                icon="add"
                :disable="uiLocked"
                @click="toAddEngineState"
              />
            </div>
            <template
              v-for="([type, engineIds], i) in Object.entries(
                categorizedEngineIds,
              )"
              :key="`engine-list-${i}`"
            >
              <div class="list-label">
                {{ getEngineTypeName(type) }}
              </div>
              <BaseListItem
                v-for="id in engineIds"
                :key="id"
                :selected="selectedId === id"
                @click="selectEngine(id)"
              >
                <img
                  v-if="engineIcons[id]"
                  class="listitem-icon"
                  :src="engineIcons[id]"
                  :alt="engineInfos[id].name"
                />
                <div v-else class="listitem-unknown">?</div>
                <div class="listitem-content">
                  {{ engineInfos[id].name }}
                  <span caption class="listitem-path">
                    {{
                      engineManifests[id] != undefined
                        ? engineManifests[id].brandName
                        : engineInfos[id].uuid
                    }}
                  </span>
                </div>
              </BaseListItem>
            </template>
          </template>
          <div v-if="isAddingEngine" class="detail">
            <BaseScrollArea>
              <div class="inner">
                <div class="title">エンジンの追加</div>
                <BaseToggleGroup v-model="engineLoaderType" type="single">
                  <BaseToggleGroupItem label="VVPPファイル" value="vvpp" />
                  <BaseToggleGroupItem label="既存エンジン" value="dir" />
                </BaseToggleGroup>
                <section v-if="engineLoaderType === 'vvpp'" class="section">
                  <div>VVPPファイルでエンジンをインストールします。</div>
                  <div class="flex-row">
                    <BaseTextField
                      v-model="vvppFilePath"
                      placeholder="VVPPファイルの場所"
                      readonly
                      :hasError="
                        newEngineDirValidationState != undefined &&
                        newEngineDirValidationState !== 'ok'
                      "
                      @click="selectVvppFile"
                    >
                      <template #error>
                        {{
                          newEngineDirValidationState
                            ? getEngineDirValidationMessage(
                                newEngineDirValidationState,
                              )
                            : undefined
                        }}
                      </template>
                    </BaseTextField>
                    <BaseButton
                      label="ファイル選択"
                      icon="folder_open"
                      @click="selectVvppFile"
                    />
                  </div>
                </section>
                <section v-if="engineLoaderType === 'dir'" class="section">
                  <div>PC内にあるエンジンを追加します。</div>
                  <div class="flex-row">
                    <BaseTextField
                      v-model="newEngineDir"
                      placeholder="エンジンフォルダの場所"
                      readonly
                      :hasError="
                        newEngineDirValidationState != undefined &&
                        newEngineDirValidationState !== 'ok'
                      "
                      @click="selectEngineDir"
                    >
                      <template #error>
                        {{
                          newEngineDirValidationState
                            ? getEngineDirValidationMessage(
                                newEngineDirValidationState,
                              )
                            : undefined
                        }}
                      </template>
                    </BaseTextField>
                    <BaseButton
                      label="フォルダ選択"
                      icon="folder_open"
                      @click="selectEngineDir"
                    />
                  </div>
                </section>
                <div class="footer">
                  <BaseButton label="キャンセル" @click="toInitialState" />
                  <BaseButton
                    label="追加"
                    icon="add"
                    variant="primary"
                    :disabled="!canAddEngine"
                    @click="addEngine"
                  />
                </div>
              </div>
            </BaseScrollArea>
          </div>
          <div v-else-if="selectedId" class="detail">
            <BaseScrollArea>
              <div class="inner">
                <div class="engine-title title">
                  <img
                    v-if="selectedId in engineIcons"
                    :src="engineIcons[selectedId]"
                    :alt="engineInfos[selectedId].name"
                    class="engine-icon"
                  />
                  <div v-else class="engine-unknown">?</div>
                  {{ engineInfos[selectedId].name }}
                </div>

                <section class="section">
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
                </section>
                <section class="section">
                  <div class="headline">機能</div>
                  <ul
                    v-if="
                      engineManifests[selectedId] &&
                      engineManifests[selectedId].supportedFeatures
                    "
                  >
                    <li
                      v-for="(value, feature) in engineManifests[selectedId]
                        .supportedFeatures != null
                        ? engineManifests[selectedId].supportedFeatures
                        : null"
                      :key="feature"
                      :class="value ? '' : 'text-warning'"
                    >
                      {{ getFeatureName(feature) }}：{{
                        value ? "対応" : "非対応"
                      }}
                    </li>
                  </ul>
                  <span v-else>（取得に失敗しました）</span>
                </section>
                <section class="section">
                  <div class="headline">場所</div>
                  <div class="flex-row">
                    <BaseTextField
                      v-model="engineDir"
                      :disabled="uiLocked || !engineInfos[selectedId].path"
                      readonly
                    />
                    <BaseButton
                      icon="folder_open"
                      label="フォルダを開く"
                      :disabled="uiLocked || !engineInfos[selectedId].path"
                      @click="openSelectedEngineDirectory"
                    />
                  </div>
                </section>
                <div class="footer">
                  <BaseButton
                    label="削除"
                    icon="delete_outline"
                    :disabled="uiLocked || engineInfos[selectedId].isDefault"
                    variant="danger"
                    @click="deleteEngine"
                  />
                  <BaseButton
                    label="再起動"
                    icon="refresh"
                    :disabled="
                      uiLocked || engineStates[selectedId] === 'STARTING'
                    "
                    @click="restartSelectedEngine"
                  />
                </div>
              </div>
            </BaseScrollArea>
          </div>
        </BaseNavigationView>
      </QPageContainer>
    </QLayout>
  </QDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseToggleGroup from "../Base/BaseToggleGroup.vue";
import BaseToggleGroupItem from "../Base/BaseToggleGroupItem.vue";
import BaseButton from "@/components/Base/BaseButton.vue";
import BaseListItem from "@/components/Base/BaseListItem.vue";
import BaseNavigationView from "@/components/Base/BaseNavigationView.vue";
import BaseTextField from "@/components/Base/BaseTextField.vue";
import BaseScrollArea from "@/components/Base/BaseScrollArea.vue";
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
      .filter((info) => info.isDefault)
      .map((info) => info.uuid),
    plugin: Object.values(sortedEngineInfos)
      .filter((info) => !info.isDefault)
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
      const version = await store.actions
        .INSTANTIATE_ENGINE_CONNECTOR({ engineId: id })
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
  const featureNameMap: { [key in keyof Required<SupportedFeatures>]: string } =
    {
      adjustMoraPitch: "モーラごとの音高の調整",
      adjustPhonemeLength: "音素ごとの長さの調整",
      adjustSpeedScale: "全体の話速の調整",
      adjustPitchScale: "全体の音高の調整",
      adjustIntonationScale: "全体の抑揚の調整",
      adjustVolumeScale: "全体の音量の調整",
      adjustPauseLength: "句読点などの無音時間の調整",
      interrogativeUpspeak: "疑問文の自動調整",
      synthesisMorphing: "2種類のスタイルでモーフィングした音声を合成",
      sing: "歌唱音声合成",
      manageLibrary: "音声ライブラリのインストール・アンインストール",
      returnResourceUrl: "キャラクター情報のリソースをURLで返送",
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
  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "エンジンを追加しますか？",
    message:
      "この操作はコンピュータに損害を与える可能性があります。エンジンの配布元が信頼できない場合は追加しないでください。",
    actionName: "追加する",
  });
  if (result === "OK") {
    if (engineLoaderType.value === "dir") {
      await lockUi(
        "addingEngine",
        store.actions.ADD_ENGINE_DIR({
          engineDir: newEngineDir.value,
        }),
      );

      void requireReload(
        "エンジンを追加しました。反映には再読み込みが必要です。",
      );
    } else {
      const success = await lockUi(
        "addingEngine",
        store.actions.INSTALL_VVPP_ENGINE(vvppFilePath.value),
      );
      if (success) {
        void requireReload(
          "エンジンを追加しました。反映には再読み込みが必要です。",
        );
      }
    }
  }
};
const deleteEngine = async () => {
  const engineId = selectedId.value;
  if (engineId == undefined) throw new Error("engine is not selected");

  const engineInfo = engineInfos.value[engineId];

  // 念の為デフォルトエンジンではないことを確認
  if (engineInfo.isDefault) {
    throw new Error("default engine cannot be deleted");
  }

  const result = await store.actions.SHOW_WARNING_DIALOG({
    title: "エンジンを削除しますか？",
    message: "選択中のエンジンを削除します。",
    actionName: "削除する",
    isWarningColorButton: true,
  });
  if (result === "OK") {
    switch (engineInfo.type) {
      case "path": {
        const engineDir = engineInfo.path;
        if (!engineDir)
          throw new Error("assert engineInfos[selectedId.value].path");
        await lockUi(
          "deletingEngine",
          store.actions.REMOVE_ENGINE_DIR({
            engineDir,
          }),
        );
        void requireReload(
          "エンジンを削除しました。反映には再読み込みが必要です。",
        );
        break;
      }
      case "vvpp": {
        const success = await lockUi(
          "deletingEngine",
          store.actions.UNINSTALL_VVPP_ENGINE(engineId),
        );
        if (success) {
          void requireReload("エンジンの削除には再読み込みが必要です。");
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
  void store.actions.OPEN_ENGINE_DIRECTORY({ engineId: selectedId.value });
};

const restartSelectedEngine = () => {
  if (selectedId.value == undefined)
    throw new Error("assert selectedId.value != undefined");
  void store.actions.RESTART_ENGINES({
    engineIds: [selectedId.value],
  });
};

const requireReload = async (message: string) => {
  const result = await store.actions.SHOW_CONFIRM_DIALOG({
    title: "再読み込みしますか？",
    message: message,
    actionName: "再読み込みする",
    cancel: "後で",
    isPrimaryColorButton: true,
  });
  toInitialState();
  if (result === "OK") {
    void store.actions.CHECK_EDITED_AND_NOT_SAVE({
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
    newEngineDirValidationState.value = await store.actions.VALIDATE_ENGINE_DIR(
      {
        engineDir: path,
      },
    );
  }
};

const vvppFilePath = ref("");
const selectVvppFile = async () => {
  const path = await window.backend.showOpenFileDialog({
    title: "vvppファイルを選択",
    name: "VOICEVOX Plugin Package",
    mimeType: "application/octet-stream",
    extensions: ["vvpp", "vvppp"],
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
@use "@/styles/v2/variables" as vars;
@use "@/styles/v2/mixin" as mixin;
@use "@/styles/v2/colors" as newcolors;

.list {
  display: flex;
  flex-direction: column;
}

.list-header {
  display: flex;
  gap: vars.$gap-1;
  align-items: center;
  justify-content: space-between;
}

.list-title {
  @include mixin.headline-2;
}

.listitem-icon {
  margin-right: vars.$gap-1;
  border-radius: vars.$radius-1;
  width: 32px;
}

.listitem-unknown {
  margin-right: vars.$gap-1;
  border-radius: vars.$radius-1;
  background-color: colors.$primary;
  display: grid;
  place-content: center;
  font-weight: 700;
  width: 32px;
  height: 32px;
}

.listitem-content {
  display: flex;
  flex-direction: column;
  align-items: start;
}

.listitem-path {
  font-size: 0.75rem;
  overflow-wrap: break-word;
}

.list-label {
  padding: 8px 16px;
  padding-top: 16px;
  color: newcolors.$display-sub;
}

.list-disable-overlay {
  background-color: rgba($color: #000000, $alpha: 0.4);
  position: absolute;
  inset: 0;
  z-index: 1;
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

.detail {
  height: 100%;
}

.inner {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  padding: vars.$padding-2;
  gap: vars.$gap-2;
}

.engine-title {
  display: flex;
  align-items: center;
  gap: vars.$gap-1;
}

.engine-icon {
  width: 40px;
  height: 40px;
  border-radius: vars.$radius-1;
}

.engine-unknown {
  width: 40px;
  height: 40px;
  border-radius: vars.$radius-1;
  background-color: colors.$primary;
  display: grid;
  place-content: center;
  font-weight: 700;
}

.title {
  @include mixin.headline-1;
}

.headline {
  @include mixin.headline-2;
}

.flex-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: vars.$gap-1;
}

.footer {
  gap: vars.$gap-1;
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}

.section {
  display: flex;
  flex-direction: column;
  gap: vars.$gap-1;
}

:deep(ul) {
  margin: 0;
}
</style>
