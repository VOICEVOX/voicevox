<template>
  <q-dialog
    maximized
    transition-show="jump-up"
    transition-hide="jump-down"
    class="transparent-backdrop"
    v-model="modelValueComputed"
  >
    <q-layout container view="hHh Lpr lff" class="bg-background">
      <q-header class="q-py-sm">
        <q-toolbar>
          <div class="column">
            <q-toolbar-title class="text-display"
              >音声ライブラリのダウンロード</q-toolbar-title
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
              :disable="isInstallingLibrary"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-drawer
        bordered
        show-if-above
        :model-value="true"
        :width="$q.screen.width / 3 > 300 ? 300 : $q.screen.width / 3"
        :breakpoint="0"
      >
        <div class="library-portrait-wrapper">
          <img
            :src="portraitUris[`${selectedEngineId}:${selectedLibrary}`]"
            class="library-portrait"
          />
        </div>
      </q-drawer>

      <q-page-container>
        <q-page class="main">
          <div
            class="q-pa-md library-items-container"
            v-for="engineId of engineIdsWithDownloadableLibraries"
            :key="engineId"
          >
            <span class="text-h6 q-py-md" v-if="engineIds.length > 1">
              {{ engineManifests[engineId].name }}
            </span>
            <div
              class="library-list-error text-warning"
              v-if="fetchStatus[engineId] === 'error'"
            >
              取得に失敗しました。
            </div>

            <div
              class="library-list"
              v-else-if="fetchStatus[engineId] === 'success'"
            >
              <q-item
                v-for="library of downloadableLibraries[engineId]"
                :key="library.speakers[0].speaker.speakerUuid"
                clickable
                v-ripple="
                  isHoverableItem &&
                  !isLatest(engineId, library) &&
                  !isInstallingLibrary
                "
                class="q-pa-none library-item"
                :class="[
                  isHoverableItem && 'hoverable-library-item',
                  selectedLibrary === library.uuid && 'selected-library-item',
                ]"
                :disable="isLatest(engineId, library) || isInstallingLibrary"
                @click="
                  selectLibrary(engineId, library.uuid);
                  togglePlayOrStop(
                    library.uuid,
                    selectedStyles[engineId][library.uuid],
                    0
                  );
                "
              >
                <div class="library-item-inner">
                  <img
                    :src="
                      iconUris[
                        `${engineId}:${library.uuid}:${
                          selectedStyleIndexes[engineId][library.uuid] || 0
                        }`
                      ]
                    "
                    class="style-icon"
                  />
                  <span class="text-subtitle1 q-ma-sm">{{
                    downloadableLibrariesMap[engineId][library.uuid].name
                  }}</span>
                  <div class="style-select-container">
                    <q-btn
                      flat
                      dense
                      icon="chevron_left"
                      text-color="display"
                      class="style-select-button"
                      :disable="library.speakers[0].speaker.styles.length <= 1"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectLibrary(engineId, library.uuid);
                        rollStyleIndex(engineId, library.uuid, -1);
                      "
                    />
                    <span>{{
                      selectedStyles[engineId][
                        library.speakers[0].speaker.speakerUuid
                      ].name || "ノーマル"
                    }}</span>
                    <q-btn
                      flat
                      dense
                      icon="chevron_right"
                      text-color="display"
                      class="style-select-button"
                      :disable="library.speakers[0].speaker.styles.length <= 1"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectLibrary(engineId, library.uuid);
                        rollStyleIndex(engineId, library.uuid, 1);
                      "
                    />
                  </div>
                  <div class="voice-samples">
                    <q-btn
                      v-for="voiceSampleIndex of [...Array(3).keys()]"
                      :key="voiceSampleIndex"
                      round
                      outline
                      :icon="
                        playing != undefined &&
                        library.uuid === playing.speakerUuid &&
                        selectedStyles[engineId][library.uuid].id ===
                          playing.styleId &&
                        voiceSampleIndex === playing.index
                          ? 'stop'
                          : 'play_arrow'
                      "
                      color="primary-light"
                      class="voice-sample-btn"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectLibrary(engineId, library.uuid);
                        togglePlayOrStop(
                          library.uuid,
                          selectedStyles[engineId][library.uuid],
                          voiceSampleIndex
                        );
                      "
                    />
                  </div>
                  <q-btn
                    outline
                    text-color="display"
                    class="text-no-wrap q-mt-sm"
                    :disable="
                      isLatest(engineId, library) || isInstallingLibrary
                    "
                    @click.stop="installLibrary(engineId, library)"
                  >
                    {{
                      isLatest(engineId, library)
                        ? "最新版です"
                        : installedLibrariesMap[engineId][library.uuid]
                        ? `アップデート：${library.bytes}`
                        : `インストール：${library.bytes}`
                    }}
                  </q-btn>
                </div>
              </q-item>
            </div>

            <q-circular-progress
              v-else-if="fetchStatus[engineId] === 'fetching'"
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
import { computed, Ref, ref, watch } from "vue";
import { useStore } from "@/store";
import { DownloadableLibrary, LibrarySpeaker, StyleInfo } from "@/openapi";
import { base64ImageToUri } from "@/helpers/imageHelper";
import { EngineId, LibraryId } from "@/type/preload";
import semver from "semver";

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
const engineInfos = computed(() => store.state.engineInfos);
const engineManifests = computed(() => store.state.engineManifests);

const engineIdsWithDownloadableLibraries = computed(() => {
  return engineIds.value.filter((engineId) => {
    return engineManifests.value[engineId]?.supportedFeatures?.manageLibrary;
  });
});

const modelValueComputed = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

type LibraryList = Record<
  string,
  (Omit<DownloadableLibrary, "uuid"> & { uuid: LibraryId })[]
>;
const downloadableLibraries = ref<LibraryList>({});
const installedLibraries = ref<LibraryList>({});

const groupLibraryWithUuid = (base: Ref<LibraryList>) => () => {
  const librariesMap: Record<string, Record<LibraryId, DownloadableLibrary>> =
    {};

  for (const engineId of engineIdsWithDownloadableLibraries.value) {
    librariesMap[engineId] = {};
    for (const library of base.value[engineId] || []) {
      librariesMap[engineId][library.uuid] = library;
    }
  }
  return librariesMap;
};
const downloadableLibrariesMap = computed(
  groupLibraryWithUuid(downloadableLibraries)
);
const installedLibrariesMap = computed(
  groupLibraryWithUuid(installedLibraries)
);

const downloadableSpeakersMap = computed(() => {
  const downloadableSpeakersMap: Record<
    string,
    Record<
      string,
      { [key in keyof LibrarySpeaker]: NonNullable<LibrarySpeaker[key]> }
    >
  > = {};

  for (const engineId of engineIdsWithDownloadableLibraries.value) {
    downloadableSpeakersMap[engineId] = {};
    for (const library of downloadableLibraries.value[engineId] || []) {
      for (const speaker of library.speakers) {
        downloadableSpeakersMap[engineId][speaker.speaker.speakerUuid] =
          speaker;
      }
    }
  }
  return downloadableSpeakersMap;
});

const isLatest = (engineId: EngineId, library: DownloadableLibrary) => {
  const installedLibrary = installedLibraries.value[engineId]?.find(
    (installedLibrary) => installedLibrary.uuid === library.uuid
  );
  if (!installedLibrary) {
    return false;
  }
  return semver.gte(library.version, installedLibrary.version);
};

const fetchStatus = ref<Record<string, "fetching" | "success" | "error">>({});

// 選択中のスタイル
const flatSelectedStyleIndexes = ref<Record<string, number>>({});
const selectedStyleIndexes = computed<Record<string, Record<string, number>>>(
  () => {
    const selectedStyleIndexes: Record<string, Record<string, number>> = {};
    for (const engineId of engineIdsWithDownloadableLibraries.value) {
      selectedStyleIndexes[engineId] = {};
      for (const [selectedStyleIndexKey, selectedStyleIndex] of Object.entries(
        flatSelectedStyleIndexes.value
      )) {
        const [engineId, speakerUuid] = selectedStyleIndexKey.split(":");
        selectedStyleIndexes[engineId][speakerUuid] = selectedStyleIndex || 0;
      }
    }
    return selectedStyleIndexes;
  }
);
const selectedStyles = computed(() => {
  const map: Record<string, Record<string, StyleInfo & { name: string }>> = {};
  for (const [engineId, engineLibraryInfos] of Object.entries(
    downloadableLibraries.value
  )) {
    map[engineId] = {};
    for (const engineLibraryInfo of engineLibraryInfos) {
      for (const { speaker, speakerInfo } of engineLibraryInfo.speakers) {
        if (!speaker || !speakerInfo) {
          continue;
        }
        const selectedStyleIndex: number | undefined =
          selectedStyleIndexes.value[engineId][speaker.speakerUuid];
        map[engineId][speaker.speakerUuid] = {
          ...speakerInfo.styleInfos[selectedStyleIndex || 0],
          name: speaker.styles[selectedStyleIndex || 0].name,
        };
      }
    }
  }
  return map;
});

// 選択中のキャラクター
const selectedLibrary = ref("");
const selectedEngineId = ref(engineIdsWithDownloadableLibraries.value[0]);
const selectLibrary = (engineId: EngineId, libraryId: LibraryId) => {
  selectedEngineId.value = engineId;
  selectedLibrary.value = libraryId;
};

const iconUris = ref<Record<string, string>>({});
const portraitUris = ref<Record<string, string>>({});
watch(
  [
    engineIdsWithDownloadableLibraries,
    engineInfos,
    engineManifests,
    modelValueComputed,
  ],
  () => {
    if (!modelValueComputed.value) {
      return;
    }
    for (const engineId of engineIdsWithDownloadableLibraries.value) {
      if (
        fetchStatus.value[engineId] === "fetching" ||
        fetchStatus.value[engineId] === "success"
      ) {
        continue;
      }
      fetchStatus.value[engineId] = "fetching";
      (async () => {
        downloadableLibraries.value[engineId] = await store
          .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          })
          .then((instance) =>
            instance.invoke("downloadableLibrariesDownloadableLibrariesGet")({})
          )
          .then((libraries) => {
            return libraries.map((library) => {
              return {
                ...library,
                uuid: LibraryId(library.uuid),
              };
            });
          });

        installedLibraries.value[engineId] = await store
          .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId,
          })
          .then((instance) =>
            instance.invoke("installedLibrariesInstalledLibrariesGet")({})
          )
          .then((libraries) => {
            return libraries.map((library) => {
              return {
                ...library,
                uuid: LibraryId(library.uuid),
              };
            });
          });

        const libraries = downloadableLibraries.value[engineId] || [];

        fetchStatus.value[engineId] = "success";
        libraries.sort((a, b) => {
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
          return toPrimaryOrder(a) - toPrimaryOrder(b);
        });

        for (const library of libraries) {
          for (const { speaker, speakerInfo } of library.speakers) {
            if (!speaker || !speakerInfo) {
              continue;
            }
            const defaultPortraitUri = base64ImageToUri(speakerInfo.portrait);
            portraitUris.value[`${engineId}:${speaker.speakerUuid}`] =
              defaultPortraitUri;
            for (const [index, style] of Object.entries(
              speakerInfo.styleInfos
            )) {
              const iconUri = base64ImageToUri(style.icon);
              iconUris.value[`${engineId}:${speaker.speakerUuid}:${index}`] =
                iconUri;
              if (style.portrait) {
                const portraitUri = base64ImageToUri(style.portrait);
                portraitUris.value[
                  `${engineId}:${speaker.speakerUuid}:${index}`
                ] = portraitUri;
              }
            }
          }
        }
      })().catch((e) => {
        fetchStatus.value[engineId] = "error";
        console.error(e);
      });
    }
  },
  { immediate: true }
);

// キャラクター枠のホバー状態を表示するかどうか
// 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
const isHoverableItem = ref(true);

// 音声再生
const playing = ref<{ speakerUuid: string; styleId: number; index: number }>();

const audio = new Audio();
audio.volume = 0.5;
audio.onended = () => stop();

const play = (
  speakerUuid: string,
  { id: styleId, voiceSamples }: StyleInfo,
  index: number
) => {
  if (audio.src !== "") stop();

  audio.src = "data:audio/wav;base64," + voiceSamples[index];
  audio.play();
  playing.value = { speakerUuid, styleId, index };
};
const stop = () => {
  if (audio.src === "") return;

  audio.pause();
  audio.removeAttribute("src");
  playing.value = undefined;
};

// 再生していたら停止、再生していなかったら再生
const togglePlayOrStop = (
  speakerUuid: string,
  styleInfo: StyleInfo,
  index: number
) => {
  if (
    playing.value === undefined ||
    speakerUuid !== playing.value.speakerUuid ||
    styleInfo.id !== playing.value.styleId ||
    index !== playing.value.index
  ) {
    play(speakerUuid, styleInfo, index);
  } else {
    stop();
  }
};

// スタイル番号をずらす
const rollStyleIndex = (
  engineId: string,
  speakerUuid: string,
  diff: number
) => {
  // 0 <= index <= length に収める
  const length =
    downloadableSpeakersMap.value[engineId][speakerUuid].speaker.styles.length;
  const selectedStyleIndex: number | undefined =
    selectedStyleIndexes.value[engineId][speakerUuid];

  let styleIndex = (selectedStyleIndex ?? 0) + diff;
  styleIndex = styleIndex < 0 ? length - 1 : styleIndex % length;

  flatSelectedStyleIndexes.value[`${engineId}:${speakerUuid}`] = styleIndex;

  // 音声を再生する。同じstyleIndexだったら停止する。
  const selectedStyleInfo =
    downloadableSpeakersMap.value[engineId][speakerUuid].speakerInfo.styleInfos[
      styleIndex
    ];
  togglePlayOrStop(speakerUuid, selectedStyleInfo, 0);
};

const closeDialog = () => {
  stop();
  modelValueComputed.value = false;
};

const isInstallingLibrary = ref(false);

const installLibrary = (engineId: EngineId, library: DownloadableLibrary) => {
  isInstallingLibrary.value = true;

  selectLibrary(engineId, LibraryId(library.uuid));
  stop();
  setTimeout(() => {
    isInstallingLibrary.value = false;
  }, 10000);
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

  display: flex;
  flex-direction: row;
  width: 100%;
  > div {
    width: 100%;
  }
}

.library-items-container {
  height: 100%;
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;
  overflow-y: scroll;

  > div.q-circular-progress {
    margin: auto;
  }
  > div.library-list {
    $library-item-size: 215px;
    display: grid;
    grid-template-columns: repeat(auto-fit, $library-item-size);
    grid-auto-rows: 275px;
    column-gap: 10px;
    row-gap: 10px;
    align-content: center;
    justify-content: center;
    // deepをつけないとdisableになったときにUIが崩壊する
    :deep(.library-item) {
      box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-library-item {
        box-shadow: 0 0 0 2px colors.$primary-light;
      }
      &:hover :deep(.q-focus-helper) {
        opacity: 0 !important;
      }
      &.hoverable-library-item:hover :deep(.q-focus-helper) {
        opacity: 0.15 !important;
      }
      .library-item-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        .style-icon {
          $icon-size: $library-item-size / 2;
          width: $icon-size;
          height: $icon-size;
          border-radius: 5px;
        }
        .style-select-container {
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: center;
          margin-top: -1rem;
        }
        .voice-samples {
          display: flex;
          column-gap: 5px;
          align-items: center;
          justify-content: center;
        }
        .new-library-item {
          color: colors.$primary-light;
          position: absolute;
          left: 0px;
          top: 0px;
        }
      }
    }
  }
}

.library-order-container {
  width: 180px;
  height: 100%;

  display: flex;
  flex-direction: column;

  .library-order {
    flex: 1;

    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;

    overflow-y: auto;

    .library-order-item {
      border-radius: 10px;
      border: 2px solid rgba(colors.$display-rgb, 0.15);
      text-align: center;
      cursor: grab;
      &.selected-library-order-item {
        border: 2px solid colors.$primary-light;
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
