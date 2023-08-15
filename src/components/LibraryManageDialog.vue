<template>
  <q-dialog
    v-model="modelValueComputed"
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="transparent-backdrop"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >音声ライブラリの管理</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <template v-if="pageIndex === 0">
              <q-btn
                round
                flat
                icon="close"
                color="display"
                @click="closeDialog"
              />
            </template>
            <template v-else-if="pageIndex === 1">
              <q-btn
                unelevated
                label="戻る"
                color="toolbar-button"
                text-color="toolbar-button-display"
                class="text-no-wrap q-mr-md"
                :disable="isButtonDisable"
                @click="prevPage"
              />
              <q-btn
                unelevated
                label="利用規約に同意してインストール"
                color="toolbar-button"
                text-color="toolbar-button-display"
                class="text-no-wrap"
                :disable="isButtonDisable"
                @click="installLibrary"
              />
            </template>
          </div>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page class="main">
          <div
            v-if="
              selectedLibrary &&
              libraryInstallStatuses[selectedLibrary] &&
              libraryInstallStatuses[selectedLibrary].status !== 'done' &&
              libraryInstallStatuses[selectedLibrary].status !== 'error'
            "
            class="loading"
          >
            <div
              v-if="
                libraryInstallStatuses[selectedLibrary].status === 'downloading'
              "
            >
              <q-circular-progress
                show-value
                font-size="0.5rem"
                :value="downloadProgress"
                size="2.5rem"
                color="primary"
                track-color="grey-3"
              >
                {{ downloadProgress ? downloadProgress.toFixed(1) : "" }}%
              </q-circular-progress>
              <div class="q-mt-xs">ダウンロード中・・・</div>
            </div>
            <div v-else>
              <q-spinner color="primary" size="2.5rem" />
              <div class="q-mt-xs">
                {{ selectedLibrary && libraryInstallStatuses[selectedLibrary] && libraryInstallStatuses[selectedLibrary!].status === "uninstalling"
                  ? "アンインストール中・・・"
                  : libraryInstallStatuses[selectedLibrary!].status === "installing"
                  ? "インストール中・・・"
                  : "インストール待機中・・・"
                }}
              </div>
            </div>
          </div>
          <q-tab-panels v-model="pageIndex">
            <!-- 試聴・ライブラリ選択画面 -->
            <q-tab-panel :name="0">
              <q-drawer
                bordered
                :model-value="true"
                :width="$q.screen.width / 3 > 300 ? 300 : $q.screen.width / 3"
                :breakpoint="0"
              >
                <div class="library-portrait-wrapper">
                  <img :src="portraitUri" class="library-portrait" />
                </div>
              </q-drawer>
              <div
                v-for="engineId of targetEngineIds"
                :key="engineId"
                class="q-pa-md library-items-container"
              >
                <span class="text-h5 q-py-md">
                  {{ engineManifests[engineId].name }}
                </span>
                <div
                  v-if="fetchStatuses[engineId] === 'error'"
                  class="library-list-error text-warning"
                >
                  取得に失敗しました。
                </div>

                <div
                  v-else-if="fetchStatuses[engineId] === 'success'"
                  class="library-list"
                >
                  <q-item
                    v-for="library of downloadableLibraries[engineId]"
                    :key="library.uuid"
                    class="q-pa-none library-item"
                    :class="
                      selectedLibrary === library.uuid &&
                      'selected-library-item'
                    "
                  >
                    <div class="library-item-inner">
                      <div class="library-header">
                        <div class="text-h6 q-ma-md library-title">
                          {{ library.name }}
                        </div>
                        <div class="library-manage-buttons q-ma-sm">
                          <q-btn
                            outline
                            text-color="display"
                            class="text-no-wrap q-ma-sm"
                            :disable="isLatest(engineId, library)"
                            @click.stop="toReadPolicies(engineId, library)"
                          >
                            {{
                              isLatest(engineId, library)
                                ? "最新版です"
                                : installedLibraries[engineId].find(
                                    (installedLibrary) =>
                                      installedLibrary.uuid === library.uuid
                                  )
                                ? "アップデート"
                                : "インストール"
                            }}
                          </q-btn>
                          <q-btn
                            outline
                            text-color="warning"
                            class="text-no-wrap q-ma-sm"
                            :disable="!isUninstallable(engineId, library)"
                            @click.stop="uninstallLibrary(engineId, library)"
                          >
                            アンインストール
                          </q-btn>
                        </div>
                      </div>
                      <div class="speaker-list">
                        <character-try-listen-card
                          v-for="characterInfo in library.speakers"
                          :key="characterInfo.metas.speakerUuid"
                          :character-info="characterInfo"
                          :is-selected="
                            selectedSpeakers[library.uuid] ===
                            characterInfo.metas.speakerUuid
                          "
                          :playing="playing"
                          :toggle-play-or-stop="
                            (speakerUuid, styleInfo, index) =>
                              togglePlayOrStop(
                                engineId,
                                library.uuid,
                                speakerUuid,
                                styleInfo.styleId,
                                index
                              )
                          "
                          class="speaker-card"
                          @update:portrait="updatePortrait"
                          @update:select-character="
                            (speakerUuid) =>
                              selectLibraryAndSpeakerAndEngine(
                                library.uuid,
                                speakerUuid,
                                engineId
                              )
                          "
                        />
                      </div>
                    </div>
                  </q-item>
                </div>
                <q-circular-progress
                  v-else
                  indeterminate
                  color="primary"
                  rounded
                  :thickness="0.3"
                  size="xl"
                />
              </div>
            </q-tab-panel>
            <!-- 利用規約画面 -->
            <q-tab-panel :name="1">
              <div>
                <span class="text-h5 q-pa-md text-bold">
                  各話者・キャラクターの利用規約をお読みください。
                </span>
              </div>
              <div class="markdown-body overflow-auto">
                <!-- eslint-disable-next-line vue/no-v-html -->
                <div class="markdown q-pa-md" v-html="policyHtml" />
              </div>
            </q-tab-panel>
          </q-tab-panels>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, toRaw, watch } from "vue";
import semver from "semver";
import { useQuasar } from "quasar";
import CharacterTryListenCard from "./CharacterTryListenCard.vue";
import { useStore } from "@/store";
import { base64ImageToUri } from "@/helpers/imageHelper";
import {
  CharacterInfo,
  EngineId,
  LibraryId,
  SpeakerId,
  StyleId,
} from "@/type/preload";
import { DownloadableLibrary, InstalledLibrary } from "@/openapi";
import { useMarkdownIt } from "@/plugins/markdownItPlugin";

type BrandedDownloadableLibrary = Omit<
  DownloadableLibrary,
  "speakers" | "uuid"
> & {
  uuid: LibraryId;
  speakers: CharacterInfo[];
};

type BrandedInstalledLibrary = BrandedDownloadableLibrary &
  Pick<InstalledLibrary, "uninstallable">;

const pageIndex = ref(0);
const prevPage = () => {
  stop();
  pageIndex.value--;
};
const nextPage = () => {
  stop();
  pageIndex.value++;
};

const $q = useQuasar();

const props =
  defineProps<{
    modelValue: boolean;
  }>();
const emit =
  defineEmits<{
    (e: "update:modelValue", val: boolean): void;
  }>();

const store = useStore();

const engineIds = computed(() => store.state.engineIds);
const engineManifests = computed(() => store.state.engineManifests);
const libraryInstallStatuses = computed(
  () => store.state.libraryInstallStatuses
);
const downloadProgress = computed(() => {
  // ダウンロード状態ではない場合はundefinedにする
  if (!selectedLibrary.value) return undefined;
  const status = libraryInstallStatuses.value[selectedLibrary.value];
  if (status.status !== "downloading") return undefined;
  return (status.downloaded / status.contentLength) * 100;
});

// ライブラリ管理機能があるエンジンIDの一覧
const targetEngineIds = computed(() => {
  return engineIds.value.filter((engineId) => {
    return engineManifests.value[engineId]?.supportedFeatures?.manageLibrary;
  });
});

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const portraitUri = ref<string | undefined>();

const closeDialog = () => {
  stop();
  modelValueComputed.value = false;
};

const downloadableLibrariesForInstall = ref<
  Record<EngineId, DownloadableLibrary[]>
>({});
const downloadableLibraries = ref<
  Record<EngineId, BrandedDownloadableLibrary[]>
>({});
const installedLibraries = ref<Record<EngineId, BrandedInstalledLibrary[]>>({});

const isLatest = (engineId: EngineId, library: BrandedDownloadableLibrary) => {
  const installedLibrary = installedLibraries.value[engineId].find(
    (installedLibrary) => installedLibrary.uuid === library.uuid
  );
  // ライブラリがインストールされていない場合はfalseとする
  if (!installedLibrary) {
    return false;
  }
  return semver.gte(library.version, installedLibrary.version);
};

const isUninstallable = (
  engineId: EngineId,
  library: BrandedDownloadableLibrary
) => {
  const installedLibrary = installedLibraries.value[engineId].find(
    (installedLibrary) => installedLibrary.uuid === library.uuid
  );
  // ライブラリがインストールされていない場合はfalseとする
  if (!installedLibrary) {
    return false;
  }
  return installedLibrary.uninstallable;
};

const isButtonDisable = computed(() => {
  return (
    selectedLibrary.value &&
    libraryInstallStatuses.value[selectedLibrary.value] &&
    (libraryInstallStatuses.value[selectedLibrary.value].status === "pending" ||
      libraryInstallStatuses.value[selectedLibrary.value].status ===
        "downloading" ||
      libraryInstallStatuses.value[selectedLibrary.value].status ===
        "installing")
  );
});

const fetchStatuses = ref<
  Record<EngineId, "fetching" | "success" | "error" | undefined>
>({});
// FIXME: エンジン毎にリロードの必要性を判断する
const librariesReloadNeeded = ref(false);
watch(libraryInstallStatuses, (newValue, oldValue) => {
  let reloadNeeded = false;
  for (const key of Object.keys(newValue)) {
    const libraryId = LibraryId(key);
    const oldState = oldValue[libraryId];
    const newState = newValue[libraryId];

    if (!oldState) {
      reloadNeeded ||= true;
      continue;
    }
    reloadNeeded ||=
      oldState.status !== newState.status && newState.status === "done";
  }
  librariesReloadNeeded.value = reloadNeeded;
});

// 選択中の話者
const selectedSpeakers = ref<Record<LibraryId, SpeakerId>>({});

// 選択中のライブラリ
const selectedLibrary = ref<LibraryId | undefined>();

// 選択中のエンジン
const selectedEngine = ref<EngineId | undefined>();

const selectLibraryAndSpeakerAndEngine = (
  libraryId: LibraryId,
  speakerId: SpeakerId,
  engineId: EngineId
) => {
  selectedLibrary.value = libraryId;
  selectedSpeakers.value[libraryId] = speakerId;
  selectedEngine.value = engineId;
};

const selectedLibraryInfo = computed(() => {
  let libraryInfo: BrandedDownloadableLibrary | undefined;
  for (const libraries of Object.values(downloadableLibraries.value)) {
    libraryInfo = libraries.find(
      (library) => library.uuid === selectedLibrary.value
    );
  }
  if (!libraryInfo) {
    throw Error("libraryInfo === undefined");
  }
  return libraryInfo;
});

const libraryInfoToCharacterInfos = (
  engineId: EngineId,
  libraryInfo: DownloadableLibrary | InstalledLibrary
): CharacterInfo[] => {
  return libraryInfo.speakers.map((speaker) => {
    return {
      portraitPath: base64ImageToUri(speaker.speakerInfo.portrait),
      metas: {
        speakerUuid: SpeakerId(speaker.speaker.speakerUuid),
        speakerName: speaker.speaker.name,
        styles: speaker.speaker.styles.map((style) => {
          const styleInfo = speaker.speakerInfo.styleInfos.find(
            (info) => info.id == style.id
          );
          if (styleInfo === undefined) {
            throw Error("styleInfo === undefined");
          }
          return {
            styleName: style.name,
            styleId: StyleId(style.id),
            iconPath: base64ImageToUri(styleInfo.icon),
            portraitPath: styleInfo.portrait
              ? base64ImageToUri(styleInfo.portrait)
              : undefined,
            engineId,
            voiceSamplePaths: styleInfo.voiceSamples,
          };
        }),
        policy: speaker.speakerInfo.policy,
      },
    };
  });
};

watch(
  [modelValueComputed, librariesReloadNeeded],
  async (newValue, oldValue) => {
    const newReloadNeeded = newValue[1];
    const oldReloadNeeded = oldValue[1];
    if (newReloadNeeded && !oldReloadNeeded) {
      targetEngineIds.value.map((engineId) => {
        fetchStatuses.value[engineId] = undefined;
      });
    }
    await Promise.all(
      targetEngineIds.value.map(async (engineId) => {
        if (
          fetchStatuses.value[engineId] === "fetching" ||
          fetchStatuses.value[engineId] === "success"
        ) {
          return;
        }

        // 読み込みが早すぎてアンインストール可能判定が壊れることがあるので、100ms sleepする
        // FIXME: もう少し賢く解決したい
        await new Promise((resolve) => setTimeout(resolve, 100));
        fetchStatuses.value[engineId] = "fetching";
        const fetchResult = await store
          .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          })
          .then((instance) =>
            Promise.all([
              instance.invoke("downloadableLibrariesDownloadableLibrariesGet")(
                {}
              ),
              instance.invoke("installedLibrariesInstalledLibrariesGet")({}),
            ])
          )
          .then(([downloadableLibraries, installedLibraries]): [
            BrandedDownloadableLibrary[],
            BrandedInstalledLibrary[]
          ] => {
            fetchStatuses.value[engineId] = "success";
            downloadableLibrariesForInstall.value[engineId] =
              downloadableLibraries;
            return [
              downloadableLibraries.map((library) => {
                return {
                  ...library,
                  uuid: LibraryId(library.uuid),
                  speakers: libraryInfoToCharacterInfos(engineId, library),
                };
              }),
              Object.entries(installedLibraries).map(([uuid, library]) => {
                return {
                  ...library,
                  uuid: LibraryId(uuid),
                  speakers: libraryInfoToCharacterInfos(engineId, library),
                };
              }),
            ];
          })
          .catch((e) => {
            fetchStatuses.value[engineId] = "error";
            store.dispatch("LOG_ERROR", e);
          });

        if (!fetchResult) return;

        const [brandedDownloadableLibraries, brandedInstalledLibraries] =
          fetchResult;
        downloadableLibraries.value[engineId] = brandedDownloadableLibraries;
        installedLibraries.value[engineId] = brandedInstalledLibraries;

        const libraries = downloadableLibraries.value[engineId] || [];
        const toPrimaryOrder = (library: BrandedDownloadableLibrary) => {
          const localLibrary = installedLibraries.value[engineId].find(
            (l) => l.uuid === library.uuid
          );
          // アップデート > 未インストール > インストール済み の順
          if (!localLibrary) {
            return 1;
          } else if (semver.gt(library.version, localLibrary?.version)) {
            return 2;
          } else {
            return 0;
          }
        };

        libraries.sort((a, b) => {
          return toPrimaryOrder(b) - toPrimaryOrder(a);
        });
      })
    );
  }
);

const updatePortrait = (portraitPath: string) => {
  portraitUri.value = portraitPath;
};

// 音声再生
const playing =
  ref<{
    libraryId: LibraryId;
    speakerUuid: SpeakerId;
    styleId: StyleId;
    index: number;
  }>();

const audio = new Audio();
audio.volume = 0.5;
audio.onended = () => stop();

const play = (
  engineId: EngineId,
  libraryId: LibraryId,
  speakerUuid: SpeakerId,
  styleId: StyleId,
  index: number
) => {
  if (audio.src !== "") stop();

  const speaker = downloadableLibraries.value[engineId]
    .find((l) => l.uuid === libraryId)
    ?.speakers.find((s) => s.metas.speakerUuid === speakerUuid);
  if (!speaker) throw new Error("speaker not found");

  const styleInfo = speaker.metas.styles.find((s) => s.styleId === styleId);
  if (!styleInfo) throw new Error("style not found");
  const voiceSamples = styleInfo.voiceSamplePaths;
  audio.src = "data:audio/wav;base64," + voiceSamples[index];
  audio.play();
  playing.value = {
    speakerUuid,
    libraryId,
    styleId,
    index,
  };
};
const stop = () => {
  if (audio.src === "") return;

  audio.pause();
  audio.removeAttribute("src");
  playing.value = undefined;
};

// 再生していたら停止、再生していなかったら再生
const togglePlayOrStop = (
  engineId: EngineId,
  libraryId: LibraryId,
  speakerUuid: SpeakerId,
  styleId: StyleId,
  index: number
) => {
  if (
    playing.value === undefined ||
    libraryId !== playing.value.libraryId ||
    speakerUuid !== playing.value.speakerUuid ||
    styleId !== playing.value.styleId ||
    index !== playing.value.index
  ) {
    play(engineId, libraryId, speakerUuid, styleId, index);
  } else {
    stop();
  }
};

// 利用規約閲覧画面へ遷移
const toReadPolicies = async (
  engineId: EngineId,
  library: BrandedDownloadableLibrary
) => {
  selectLibraryAndSpeakerAndEngine(
    library.uuid,
    library.speakers[0].metas.speakerUuid,
    engineId
  );
  stop();
  nextPage();
};

const installLibrary = async () => {
  const library = selectedLibraryInfo.value;
  const libraryId = library.uuid;
  if (!selectedEngine.value) {
    throw Error("selectedEngine.value is undefined");
  }
  const libraryForInstall = downloadableLibrariesForInstall.value[
    selectedEngine.value
  ].find((d) => d.uuid == libraryId.toString());
  if (!libraryForInstall) {
    throw Error("libraryForInstall is undefined");
  }
  store.dispatch("START_LIBRARY_DOWNLOAD", {
    engineId: selectedEngine.value,
    library: toRaw(libraryForInstall),
  });
};

const installLibraryCompleteOrFailedDialog = () => {
  if (!selectedLibrary.value) throw Error("electedLibrary === undefined");

  const libraryName = selectedLibraryInfo.value.name;
  if (libraryInstallStatuses.value[selectedLibrary.value].status === "done") {
    requireRestart(
      `${libraryName}をインストールしました。反映には再起動が必要です。今すぐ再起動しますか？`
    );
  } else {
    $q.dialog({
      title: "インストール失敗",
      message: `${libraryName}のインストールに失敗しました。`,
      noBackdropDismiss: true,
      ok: {
        label: "戻る",
        flat: true,
        textColor: "display",
      },
    });
    pageIndex.value = 0;
  }
};
watch(libraryInstallStatuses, (newValue, oldValue) => {
  if (!selectedLibrary.value)
    throw Error("selectedLibrary.value === undefined");
  if (
    (newValue[selectedLibrary.value].status === "done" ||
      newValue[selectedLibrary.value].status === "error") &&
    (oldValue[selectedLibrary.value].status === "downloading" ||
      oldValue[selectedLibrary.value].status === "installing")
  ) {
    installLibraryCompleteOrFailedDialog();
  }
});

const uninstallLibrary = async (
  engineId: EngineId,
  library: BrandedDownloadableLibrary
) => {
  selectLibraryAndSpeakerAndEngine(
    library.uuid,
    library.speakers[0].metas.speakerUuid,
    engineId
  );
  stop();
  $q.dialog({
    title: "アンインストール",
    message: `${library.name}をアンインストールします。よろしいですか？`,
    noBackdropDismiss: true,
    cancel: {
      label: "いいえ",
      color: "display",
      flat: true,
    },
    ok: {
      label: "はい",
      flat: true,
      textColor: "warning",
    },
  }).onOk(async () => {
    try {
      await store.dispatch("UNINSTALL_LIBRARY", {
        engineId,
        libraryId: library.uuid,
      });
      if (libraryInstallStatuses.value[library.uuid].status === "done") {
        requireRestart(
          `${library.name}をアンインストールしました。反映には再起動が必要です。今すぐ再起動しますか？`
        );
      }
    } catch (e) {
      $q.dialog({
        title: "アンインストール失敗",
        message: `${library.name}のアンインストールに失敗しました。`,
        noBackdropDismiss: true,
        ok: {
          label: "閉じる",
          flat: true,
          textColor: "display",
        },
      });
    }
  });
};

const requireRestart = (message: string) => {
  $q.dialog({
    title: "再起動が必要です",
    message: message,
    noBackdropDismiss: true,
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
      pageIndex.value = 0;
      store.dispatch("RELOAD_APP", {});
    })
    .onCancel(() => {
      pageIndex.value = 0;
    });
};

const md = useMarkdownIt();
const policyHtml = computed(() => {
  let result = "";
  for (const characterInfo of selectedLibraryInfo.value.speakers) {
    result += md.render(characterInfo.metas.policy);
  }
  return result;
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-toolbar div:first-child {
  min-width: 0;
}
.library-portrait-wrapper {
  display: grid;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  .library-portrait {
    margin: auto;
  }
}

.main {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );
  width: 100%;
  overflow-y: scroll;
  > div {
    width: 100%;
  }
}

.loading {
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

.library-items-container {
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;

  cursor: pointer;

  .library-header {
    display: flex;
    flex-direction: row;
    width: 100%;
    align-items: center;

    > .library-title {
      margin-right: auto;
    }

    > .library-manage-buttons {
      display: flex;
      flex-direction: row;

      justify-content: center;
      margin-left: auto;
    }
  }

  > div.q-circular-progress {
    margin: auto;
  }
  > div.library-list {
    display: flex;
    flex-direction: column;
    margin: 0 10px;
    align-content: center;
    justify-content: center;
    // deepをつけないとdisableになったときにUIが崩壊する
    :deep(.library-item) {
      margin: 10px 0;
      box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-library-item {
        box-shadow: 0 0 0 2px colors.$primary-light;
      }
      &:hover :deep(.q-focus-helper) {
        opacity: 0 !important;
      }
      .library-item-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;

        .speaker-list {
          display: flex;
          flex-direction: row;
          overflow-x: auto;
          margin-left: auto;
          margin-right: auto;
          margin-bottom: 20px;
          max-width: 90%;

          .speaker-card {
            height: vars.$character-item-size;
            margin: 10px;
            grid-auto-rows: vars.$character-item-size;
            min-width: vars.$character-item-size;
          }
        }
      }
    }
  }
}

.q-layout-container > :deep(.absolute-full) {
  right: 0 !important;
  > .scroll {
    width: unset !important;
    overflow: hidden;
  }
}

@media screen and (max-width: 880px) {
  .q-drawer-container {
    display: none;
  }
  .q-page-container {
    padding-left: unset !important;
    .q-page-sticky {
      left: 0 !important;
    }
  }
}
</style>
