<template>
  <span class="text-h6 q-py-md">
    {{ engineManifests[props.engineId].name }}
  </span>
  <div class="library-list-error text-warning" v-if="fetchStatus === 'error'">
    取得に失敗しました。
  </div>

  <div class="library-list" v-else-if="fetchStatus === 'success'">
    <q-item
      v-for="library of downloadableLibraries"
      :key="library.uuid"
      clickable
      v-ripple="
        isHoverableItem &&
        !isLatest(props.engineId, library) &&
        !isInstallingLibrary
      "
      class="q-pa-none library-item"
      :class="[
        isHoverableItem && 'hoverable-library-item',
        selectedLibrary === library.uuid && 'selected-library-item',
      ]"
      :disable="isLatest(props.engineId, library) || isInstallingLibrary"
      @click="selectLibrary(props.engineId, library.uuid)"
    >
      <div class="library-item-inner">
        <img
          :src="
            iconUris[
              `${props.engineId}:${library.uuid}:${
                selectedSpeakers[library.uuid].speaker.speakerUuid
              }:${
                selectedStyleIndexes[library.uuid][
                  selectedSpeakers[library.uuid].speaker.speakerUuid
                ] || 0
              }`
            ]
          "
          :alt="`${props.engineId}:${library.uuid}:${
            selectedSpeakersMap[props.engineId][library.uuid].speaker
              .speakerUuid
          }:${selectedStyleIndexes[props.engineId][library.uuid] || 0}`"
          class="style-icon"
        />
        <span class="text-subtitle1 q-ma-sm">{{
          downloadableLibrariesMap[props.engineId][library.uuid].name
        }}</span>
        <div class="style-select-container">
          <q-btn
            flat
            dense
            icon="chevron_left"
            text-color="display"
            class="style-select-button"
            :disable="
              !selectedSpeakersMap[props.engineId][library.uuid] ||
              selectedSpeakersMap[props.engineId][library.uuid].speaker.styles
                .length <= 1
            "
            @mouseenter="isHoverableItem = false"
            @mouseleave="isHoverableItem = true"
            @click.stop="
              selectLibrary(props.engineId, library.uuid);
              rollStyleIndex(
                props.engineId,
                library.uuid,
                SpeakerId(
                  selectedSpeakersMap[props.engineId][library.uuid].speaker
                    .speakerUuid
                ),
                -1
              );
            "
          />
          <span>{{
            (selectedStyles[props.engineId] &&
              selectedStyles[props.engineId][library.uuid] &&
              selectedSpeakersIndex[props.engineId] &&
              selectedSpeakersIndex[props.engineId][library.uuid] &&
              selectedStyles[props.engineId][library.uuid][
                selectedSpeakersIndex[props.engineId][library.uuid]
              ] &&
              selectedStyles[props.engineId][library.uuid][
                selectedSpeakersIndex[props.engineId][library.uuid]
              ].name) ||
            "ノーマル"
          }}</span>
          <q-btn
            flat
            dense
            icon="chevron_right"
            text-color="display"
            class="style-select-button"
            :disable="
              !selectedSpeakersMap[props.engineId][library.uuid] ||
              selectedSpeakersMap[props.engineId][library.uuid].speaker.styles
                .length <= 1
            "
            @mouseenter="isHoverableItem = false"
            @mouseleave="isHoverableItem = true"
            @click.stop="
              selectLibrary(props.engineId, library.uuid);
              rollStyleIndex(
                props.engineId,
                library.uuid,
                SpeakerId(
                  selectedSpeakersMap[props.engineId][library.uuid].speaker
                    .speakerUuid
                ),
                1
              );
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
              library.uuid === playing.libraryId &&
              selectedSpeakersMap[props.engineId][library.uuid].speaker
                .speakerUuid === playing.speakerUuid &&
              voiceSampleIndex === playing.index
                ? 'stop'
                : 'play_arrow'
            "
            color="primary-light"
            class="voice-sample-btn"
            @mouseenter="isHoverableItem = false"
            @mouseleave="isHoverableItem = true"
            @click.stop="
              selectLibrary(props.engineId, library.uuid);
              togglePlayOrStop(
                props.engineId,
                library.uuid,
                SpeakerId(
                  selectedSpeakersMap[props.engineId][library.uuid].speaker
                    .speakerUuid
                ),
                StyleId(
                  selectedStyleIndexes[props.engineId][library.uuid][
                    selectedSpeakersMap[props.engineId][library.uuid].speaker
                      .speakerUuid
                  ] || 0
                ),
                voiceSampleIndex
              );
            "
          />
        </div>
        <q-btn
          outline
          text-color="display"
          class="text-no-wrap q-mt-sm"
          :disable="isLatest(props.engineId, library) || isInstallingLibrary"
          @click.stop="installLibrary(props.engineId, library)"
        >
          {{
            isLatest(props.engineId, library)
              ? "最新版です"
              : installedLibrariesMap[props.engineId][library.uuid]
              ? `アップデート`
              : `インストール`
          }}
        </q-btn>
      </div>
    </q-item>
  </div>

  <q-circular-progress
    v-else-if="fetchStatus[props.engineId] === 'fetching'"
    indeterminate
    color="primary"
    rounded
    :thickness="0.3"
    size="xl"
  />
</template>

<script setup lang="ts">
import { computed, Ref, ref, watch } from "vue";
import semver from "semver";
import { useStore } from "@/store";
import { DownloadableLibrary, LibrarySpeaker, StyleInfo } from "@/openapi";
import { base64ImageToUri } from "@/helpers/imageHelper";
import { EngineId, LibraryId, SpeakerId, StyleId } from "@/type/preload";

type BrandedDownloadableLibrary = DownloadableLibrary & {
  uuid: LibraryId;
  speakers: (LibrarySpeaker & {
    speaker: LibrarySpeaker["speaker"] & {
      speakerUuid: SpeakerId;
    };
  })[];
};

const props =
  defineProps<{
    engineId: EngineId;
  }>();
const emit =
  defineEmits<{
    (e: "update:selectedLibrary", library: BrandedDownloadableLibrary): void;
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

const downloadableLibraries = ref<BrandedDownloadableLibrary[]>([]);
const installedLibraries = ref<BrandedDownloadableLibrary[]>([]);

const downloadableSpeakersMap = computed(() => {
  const downloadableSpeakersMap: Record<
    string,
    Record<string, BrandedDownloadableLibrary["speakers"][number]>
  > = {};

  for (const engineId of engineIdsWithDownloadableLibraries.value) {
    downloadableSpeakersMap[engineId] = {};
    for (const library of downloadableLibraries.value[engineId] || []) {
      downloadableSpeakersMap[engineId][library.uuid] = {};
      for (const speaker of library.speakers) {
        downloadableSpeakersMap[engineId][library.uuid][
          speaker.speaker.speakerUuid
        ] = speaker;
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

const fetchStatus =
  ref<"fetching" | "success" | "error" | undefined>(undefined);

// 選択中のスタイル
const flatSelectedStyleIndexes = ref<Record<string, number>>({});
const selectedStyleIndexes = computed<
  Record<LibraryId, Record<SpeakerId, number>>
>(() => {
  const selectedStyleIndexes: Record<
    EngineId,
    Record<LibraryId, Record<SpeakerId, number>>
  > = {};
  for (const engineId of engineIdsWithDownloadableLibraries.value) {
    selectedStyleIndexes[engineId] = {};
    for (const library of downloadableLibraries.value) {
      selectedStyleIndexes[engineId][library.uuid] = {};
      for (const speaker of library.speakers) {
        selectedStyleIndexes[engineId][library.uuid][
          speaker.speaker.speakerUuid
        ] = 0;
      }
    }
    for (const [selectedStyleIndexKey, selectedStyleIndex] of Object.entries(
      flatSelectedStyleIndexes.value
    )) {
      const [libraryIdRaw, speakerUuidRaw] = selectedStyleIndexKey.split(":");
      const libraryId = LibraryId(libraryIdRaw);
      const speakerUuid = SpeakerId(speakerUuidRaw);

      selectedStyleIndexes[engineId][libraryId][speakerUuid] =
        selectedStyleIndex;
    }
  }
  return selectedStyleIndexes;
});
const selectedStyles = computed(() => {
  const map: Record<
    EngineId,
    Record<LibraryId, (StyleInfo & { name: string })[]>
  > = {};
  for (const [engineIdRaw, engineLibraryInfos] of Object.entries(
    downloadableLibraries.value
  )) {
    const engineId = EngineId(engineIdRaw);
    map[engineId] = {};
    for (const engineLibraryInfo of engineLibraryInfos) {
      map[engineId][engineLibraryInfo.uuid] = engineLibraryInfo.speakers.map(
        (speaker) => {
          const selectedStyleIndex: number | undefined =
            selectedStyleIndexes.value[engineId]?.[engineLibraryInfo.uuid]?.[
              SpeakerId(speaker.speaker.speakerUuid)
            ];

          return {
            ...speaker.speakerInfo.styleInfos[selectedStyleIndex ?? 0],
            name: speaker.speaker.styles[selectedStyleIndex ?? 0].name,
          };
        }
      );
    }
  }
  return map;
});

// 選択中の話者
const selectedSpeakersIndex: Record<LibraryId, number> = {};
const selectedSpeakers = computed(() => {
  const map: Record<LibraryId, BrandedDownloadableLibrary["speakers"][number]> =
    {};
  return map;
});

// 選択中のキャラクター
const selectedLibrary = ref<LibraryId>("" as LibraryId);
const selectedEngineId = ref(engineIdsWithDownloadableLibraries.value[0]);
const selectLibrary = (engineId: EngineId, libraryId: LibraryId) => {
  selectedEngineId.value = engineId;
  selectedLibrary.value = libraryId;
};

const iconUris = ref<Record<string, string>>({});
const portraitUris = ref<Record<string, string>>({});
watch(
  [engineInfos, engineManifests],
  () => {
    if (fetchStatus.value === "fetching" || fetchStatus.value === "success") {
      return;
    }
    fetchStatus.value = "fetching";
    (async () => {
      const [brandedDownloadableLibraies, brandedInstalledLibraries] =
        await store
          .dispatch("INSTANTIATE_ENGINE_CONNECTOR", {
            engineId: props.engineId,
          })
          .then((instance) =>
            Promise.all([
              instance.invoke("downloadableLibrariesDownloadableLibrariesGet")(
                {}
              ),
              instance.invoke("installedLibrariesInstalledLibrariesGet")({}),
            ])
          )
          .then((libraryEndpoints) =>
            libraryEndpoints.map((libraries) =>
              libraries.map((library) => ({
                ...library,
                uuid: LibraryId(library.uuid),
                speakers: library.speakers.map((speaker) => ({
                  speaker: {
                    ...speaker.speaker,
                    speakerUuid: SpeakerId(speaker.speaker.speakerUuid),
                  },
                  speakerInfo: speaker.speakerInfo,
                })),
              }))
            )
          );

      downloadableLibraries.value = brandedDownloadableLibraies;
      installedLibraries.value = brandedInstalledLibraries;

      const libraries = downloadableLibraries.value || [];

      fetchStatus.value = "success";
      libraries.sort((a, b) => {
        const toPrimaryOrder = (library: DownloadableLibrary) => {
          const localLibrary = installedLibraries.value.find(
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
        return toPrimaryOrder(b) - toPrimaryOrder(a);
      });

      selectedSpeakersIndex.value = {};
      for (const library of libraries) {
        selectedSpeakersIndex.value[library.uuid] = 0;
        for (const { speaker, speakerInfo } of library.speakers) {
          if (!speaker || !speakerInfo) {
            continue;
          }
          const defaultPortraitUri = base64ImageToUri(speakerInfo.portrait);
          for (const [index, style] of Object.entries(speakerInfo.styleInfos)) {
            const iconUri = base64ImageToUri(style.icon);
            iconUris.value[
              `${engineId}:${library.uuid}:${speaker.speakerUuid}:${index}`
            ] = iconUri;
            portraitUris.value[
              `${engineId}:${library.uuid}:${speaker.speakerUuid}:${index}`
            ] = style.portrait
              ? base64ImageToUri(style.portrait)
              : defaultPortraitUri;
          }
        }
      }
    })().catch((e) => {
      fetchStatus.value[engineId] = "error";
      console.error(e);
    });
  },
  { immediate: true }
);

const portraitUri = computed(() => {
  if (!selectedEngineId.value || !selectedLibrary.value) {
    return "";
  }
  return portraitUris.value[
    `${selectedEngineId.value}:${selectedLibrary.value}:${
      selectedSpeakersMap.value[selectedEngineId.value][selectedLibrary.value]
        .speaker.speakerUuid
    }:${
      selectedStyleIndexes.value[selectedEngineId.value][selectedLibrary.value][
        SpeakerId(
          selectedSpeakersMap.value[selectedEngineId.value]?.[
            selectedLibrary.value
          ]?.speaker.speakerUuid
        )
      ]
    }`
  ];
});

// キャラクター枠のホバー状態を表示するかどうか
// 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
const isHoverableItem = ref(true);

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
    ?.find((l) => l.uuid === libraryId)
    ?.speakers.find((s) => s.speaker.speakerUuid === speakerUuid);
  if (!speaker) return;

  const styleInfo = speaker.speakerInfo.styleInfos[index];
  const voiceSamples = styleInfo.voiceSamples;
  audio.src = "data:audio/wav;base64," + voiceSamples[index];
  audio.play();
  playing.value = {
    speakerUuid,
    libraryId,
    styleId,
    index,
  };
  console.log("play", playing.value);
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
    speakerUuid !== playing.value.speakerUuid ||
    styleId !== playing.value.styleId ||
    index !== playing.value.index
  ) {
    play(engineId, libraryId, speakerUuid, styleId, index);
  } else {
    stop();
  }
};

// スタイル番号をずらす
const rollStyleIndex = (
  engineId: EngineId,
  libraryId: LibraryId,
  speakerUuid: SpeakerId,
  diff: number
) => {
  const speaker = downloadableLibrariesMap.value[engineId]?.[
    libraryId
  ].speakers.find((s) => s.speaker.speakerUuid === speakerUuid);
  if (!speaker) return;
  // 0 <= index <= length に収める
  const length = speaker.speakerInfo.styleInfos.length;
  const selectedStyleIndex: number | undefined =
    selectedStyleIndexes.value[engineId][libraryId][speakerUuid];

  let styleIndex = (selectedStyleIndex ?? 0) + diff;
  styleIndex = styleIndex < 0 ? length - 1 : styleIndex % length;

  flatSelectedStyleIndexes.value[`${engineId}:${libraryId}:${speakerUuid}`] =
    styleIndex;

  // 音声を再生する。同じstyleIndexだったら停止する。
  const selectedStyleInfo =
    downloadableSpeakersMap.value[engineId][libraryId][speakerUuid].speakerInfo
      .styleInfos[styleIndex];

  if (playing.value) {
    if (
      playing.value.speakerUuid === speakerUuid &&
      playing.value.styleId === StyleId(selectedStyleInfo.id)
    ) {
      stop();
      return;
    }
  }

  const styleId = StyleId(selectedStyleInfo.id);
  togglePlayOrStop(engineId, libraryId, speakerUuid, styleId, 0);
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
  width: 100%;
  overflow-y: scroll;
  > div {
    width: 100%;
  }
}

.library-items-container {
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;

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
