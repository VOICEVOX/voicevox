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
            <q-btn
              round
              flat
              icon="close"
              color="display"
              @click="closeDialog"
            />
          </div>
        </q-toolbar>
      </q-header>

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

      <q-page-container>
        <q-page class="main">
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
                v-for="(library, libraryUuid) in downloadableLibraries[
                  engineId
                ]"
                :key="libraryUuid"
                class="q-pa-none library-item"
                :class="
                  selectedLibrary === libraryUuid && 'selected-library-item'
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
                        @click.stop="installLibrary(engineId, library)"
                      >
                        {{
                          isLatest(engineId, library)
                            ? "最新版です"
                            : installedLibraries[engineId].find(
                                (installedLibrary) =>
                                  installedLibrary.uuid === libraryUuid
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
                          selectLibraryAndSpeaker(library.uuid, speakerUuid)
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
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
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
import {
  DownloadableLibrary as EngineDownloadableLibrary,
  InstalledLibrary as EngineInstalledLibrary,
} from "@/openapi";

type DownloadableLibrary = Omit<
  EngineDownloadableLibrary,
  "speakers" | "uuid"
> & {
  uuid: LibraryId;
  speakers: CharacterInfo[];
};

type InstalledLibrary = DownloadableLibrary &
  Pick<EngineInstalledLibrary, "uninstallable">;

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

const downloadableLibraries = ref<
  Record<EngineId, Record<LibraryId, DownloadableLibrary>>
>({});
const installedLibraries = ref<Record<EngineId, InstalledLibrary[]>>({});

const isLatest = (engineId: EngineId, library: DownloadableLibrary) => {
  const installedLibrary = installedLibraries.value[engineId].find(
    (installedLibrary) => installedLibrary.uuid === library.uuid
  );
  // ライブラリがインストールされていない場合はfalseとする
  if (!installedLibrary) {
    return false;
  }
  // installedLibrary.versionがlibrary.versionと等しいか、それより大きい場合はlatest
  return semver.gte(installedLibrary.version, library.version);
};

const isUninstallable = (engineId: EngineId, library: DownloadableLibrary) => {
  const installedLibrary = installedLibraries.value[engineId].find(
    (installedLibrary) => installedLibrary.uuid === library.uuid
  );
  // ライブラリがインストールされていない場合はfalseとする
  if (!installedLibrary) {
    return false;
  }
  return installedLibrary.uninstallable;
};

const fetchStatuses = ref<
  Record<EngineId, "fetching" | "success" | "error" | undefined>
>({});

// 選択中の話者
const selectedSpeakers = ref<Record<LibraryId, SpeakerId>>({});

// 選択中のライブラリ
const selectedLibrary = ref<LibraryId | undefined>();
const selectLibraryAndSpeaker = (
  libraryId: LibraryId,
  speakerId: SpeakerId
) => {
  selectedLibrary.value = libraryId;
  selectedSpeakers.value[libraryId] = speakerId;
};

const isValidHttpUrl = (url: string): boolean => {
  try {
    const newUrl = new URL(url);
    return newUrl.protocol === "http:" || newUrl.protocol === "https:";
  } catch (e) {
    return false;
  }
};

const libraryInfoToCharacterInfos = (
  engineId: EngineId,
  libraryInfo: EngineDownloadableLibrary | EngineInstalledLibrary
): CharacterInfo[] => {
  return libraryInfo.speakers.map((speaker) => {
    const portrait = speaker.speakerInfo.portrait;
    return {
      portraitPath: isValidHttpUrl(portrait)
        ? portrait
        : base64ImageToUri(portrait),
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
          let portraitPath = styleInfo.portrait;
          if (portraitPath && !isValidHttpUrl(portraitPath)) {
            portraitPath = base64ImageToUri(portraitPath);
          }
          return {
            styleName: style.name,
            styleId: StyleId(style.id),
            iconPath: isValidHttpUrl(styleInfo.icon)
              ? styleInfo.icon
              : base64ImageToUri(styleInfo.icon),
            portraitPath,
            engineId,
            voiceSamplePaths: styleInfo.voiceSamples,
          };
        }),
        policy: speaker.speakerInfo.policy,
      },
    };
  });
};

watch(modelValueComputed, async (newValue) => {
  if (!newValue) {
    return;
  }
  await Promise.all(
    targetEngineIds.value.map(async (engineId) => {
      if (
        fetchStatuses.value[engineId] === "fetching" ||
        fetchStatuses.value[engineId] === "success"
      ) {
        return;
      }
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
        .then(([engineDownloadableLibraries, engineInstalledLibraries]): [
          DownloadableLibrary[],
          InstalledLibrary[]
        ] => {
          fetchStatuses.value[engineId] = "success";
          return [
            engineDownloadableLibraries.map((library) => {
              return {
                ...library,
                uuid: LibraryId(library.uuid),
                speakers: libraryInfoToCharacterInfos(engineId, library),
              };
            }),
            Object.entries(engineInstalledLibraries).map(([uuid, library]) => {
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

      const [convertedDownloadableLibraries, convertedInstalledLibraries] =
        fetchResult;

      const toPrimaryOrder = (library: DownloadableLibrary) => {
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

      convertedDownloadableLibraries.sort((a, b) => {
        return toPrimaryOrder(b) - toPrimaryOrder(a);
      });
      downloadableLibraries.value[engineId] = {};
      for (const downloadableLibrary of convertedDownloadableLibraries) {
        downloadableLibraries.value[engineId][downloadableLibrary.uuid] =
          downloadableLibrary;
      }
      installedLibraries.value[engineId] = convertedInstalledLibraries;
    })
  );
});

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

  const speaker = downloadableLibraries.value[engineId][
    libraryId
  ].speakers.find((s) => s.metas.speakerUuid === speakerUuid);
  if (!speaker) throw new Error("speaker not found");

  const styleInfo = speaker.metas.styles.find((s) => s.styleId === styleId);
  if (!styleInfo) throw new Error("style not found");
  const voiceSample = styleInfo.voiceSamplePaths[index];
  // インターネット上の音声はそのままsrcに設定する
  if (isValidHttpUrl(voiceSample)) {
    audio.src = voiceSample;
  } else {
    audio.src = "data:audio/wav;base64," + voiceSample;
  }
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

const installLibrary = async (
  engineId: EngineId,
  library: DownloadableLibrary
) => {
  selectLibraryAndSpeaker(
    LibraryId(library.uuid),
    SpeakerId(library.speakers[0].metas.speakerUuid)
  );
  stop();
  // TODO: インストール処理を追加する
};

const uninstallLibrary = async (
  engineId: EngineId,
  library: DownloadableLibrary
) => {
  selectLibraryAndSpeaker(
    LibraryId(library.uuid),
    SpeakerId(library.speakers[0].metas.speakerUuid)
  );
  stop();
  // TODO: アンインストール処理を追加する
};
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

.installing {
  background-color: rgba(colors.$display-rgb, 0.15);
  position: fixed;
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
