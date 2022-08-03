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
              >設定 / キャラクターダウンロード</q-toolbar-title
            >
          </div>

          <q-space />

          <div class="row items-center no-wrap">
            <q-btn
              unelevated
              label="完了"
              color="background-light"
              text-color="display-dark"
              class="text-no-wrap"
              @click="closeDialog"
              v-if="!isDownloading"
            />
          </div>
        </q-toolbar>
      </q-header>

      <q-page-container>
        <q-page class="main">
          <div class="character-items-container">
            <p class="q-ma-sm">
              ダウンロードの反映にはソフトの再起動が必要です
            </p>
            <p class="q-ma-sm">
              インターネットに接続していない場合、アップデート情報が取得できないことがあります。
            </p>
            <span class="text-h6 q-py-md">ダウンロード一覧</span>
            <div>
              <q-item
                v-for="speakerUuid of sampleCharacterOrder"
                :key="speakerUuid"
                clickable
                v-ripple="isHoverableItem"
                class="q-pa-none character-item"
                :class="[
                  isHoverableItem && 'hoverable-character-item',
                  selectedCharacter === speakerUuid &&
                    'selected-character-item',
                ]"
                @click="selectCharacter(speakerUuid)"
              >
                <div class="character-item-inner">
                  <img
                    :src="
                      'data:image/png;base64,' +
                      speakerInfosMap[speakerUuid].styleInfos[
                        selectedStyleIndexes[speakerUuid] ?? 0
                      ].icon
                    "
                    class="style-icon"
                  />
                  <span class="text-subtitle1 q-ma-sm">{{
                    speakersMap[speakerUuid].name
                  }}</span>
                  <div
                    v-if="speakerInfosMap[speakerUuid].styleInfos.length > 1"
                    class="style-select-container"
                  >
                    <q-btn
                      flat
                      dense
                      icon="chevron_left"
                      color="background-light"
                      text-color="display-dark"
                      class="style-select-button"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectCharacter(speakerUuid);
                        rollStyleIndex(speakerUuid, -1);
                      "
                    />
                    <span>{{
                      selectedStyles[speakerUuid].styleName || "ノーマル"
                    }}</span>
                    <q-btn
                      flat
                      dense
                      icon="chevron_right"
                      color="background-light"
                      text-color="display-dark"
                      class="style-select-button"
                      @mouseenter="isHoverableItem = false"
                      @mouseleave="isHoverableItem = true"
                      @click.stop="
                        selectCharacter(speakerUuid);
                        rollStyleIndex(speakerUuid, 1);
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
                        selectedStyles[speakerUuid].styleId ===
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
                        selectCharacter(speakerUuid);
                        togglePlayOrStop(
                          selectedStyles[speakerUuid],
                          voiceSampleIndex
                        );
                      "
                    />
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="
                      !isDownloading &&
                      downloadInfosMap[speakerUuid].latestModelExists
                    "
                  >
                    <p>ダウンロード済み</p>
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="
                      !isDownloading &&
                      !downloadedMap[speakerUuid] &&
                      !downloadInfosMap[speakerUuid].latestModelExists &&
                      downloadInfosMap[speakerUuid].characterExists
                    "
                  >
                    <q-btn
                      outline
                      @click.stop="
                        selectCharacter(speakerUuid);
                        downloadCharacter(speakerUuid);
                      "
                      >アップデート</q-btn
                    >
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="
                      !isDownloading &&
                      !downloadedMap[speakerUuid] &&
                      !downloadInfosMap[speakerUuid].characterExists
                    "
                  >
                    <q-btn
                      outline
                      @click.stop="
                        selectCharacter(speakerUuid);
                        downloadCharacter(speakerUuid);
                      "
                      >ダウンロード</q-btn
                    >
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="isDownloading && downloadingUuid === speakerUuid"
                  >
                    <p>{{ downloadedPercent }}</p>
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="isDownloading && !(downloadingUuid === speakerUuid)"
                  >
                    <p>ダウンロード待ち</p>
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="
                      !isDownloading &&
                      downloadedMap[speakerUuid] &&
                      !downloadErrorMap[speakerUuid]
                    "
                  >
                    <p>ダウンロード完了</p>
                  </div>
                  <div
                    class="q-pa-sm q-gutter-sm"
                    v-if="
                      !isDownloading &&
                      downloadedMap[speakerUuid] &&
                      downloadErrorMap[speakerUuid]
                    "
                  >
                    <p>エラー</p>
                  </div>
                  <div class="detail q-pa-sm text-weight-bold">
                    <p>
                      容量:
                      {{
                        downloadInfosMap[speakerUuid].downloadableModel.volume
                      }}
                    </p>
                    <p v-if="downloadInfosMap[speakerUuid].characterExists">
                      現在: {{ downloadInfosMap[speakerUuid].currentVersion }}
                    </p>
                    <p>
                      最新:
                      {{
                        downloadInfosMap[speakerUuid].downloadableModel.speaker
                          .version
                      }}
                    </p>
                  </div>
                </div>
              </q-item>
            </div>
          </div>
        </q-page>
      </q-page-container>
    </q-layout>
  </q-dialog>
</template>

<script lang="ts">
import { defineComponent, computed, ref, PropType, watch } from "vue";
import { DownloadInfo, Speaker, SpeakerInfo } from "@/openapi";
import { StyleInfo } from "@/type/preload";
import { unzip, unzipSync } from "fflate";
import fs from "fs";

export default defineComponent({
  name: "CharacterDownloadDialog",
  props: {
    modelValue: {
      type: Boolean,
      required: true,
    },
    downloadInfos: {
      type: Object as PropType<DownloadInfo[]>,
      required: true,
    },
  },

  setup(props, { emit }) {
    const modelValueComputed = computed({
      get: () => props.modelValue,
      set: (val) => emit("update:modelValue", val),
    });

    const speakerInfosMap = computed(() => {
      const map: { [key: string]: SpeakerInfo } = {};
      props.downloadInfos.forEach((downloadInfo) => {
        map[downloadInfo.downloadableModel.speaker.speakerUuid] =
          downloadInfo.downloadableModel.speakerInfo;
      });
      return map;
    });

    const speakersMap = computed(() => {
      const map: { [key: string]: Speaker } = {};
      props.downloadInfos.forEach((downloadInfo) => {
        map[downloadInfo.downloadableModel.speaker.speakerUuid] =
          downloadInfo.downloadableModel.speaker;
      });
      return map;
    });

    // サンプルボイス一覧のキャラクター順番
    const sampleCharacterOrder = ref<string[]>([]);

    // 選択中のスタイル
    const selectedStyleIndexes = ref(
      Object.fromEntries(
        props.downloadInfos.map((downloadInfo) => [
          downloadInfo.downloadableModel.speaker.speakerUuid,
          0,
        ])
      )
    );

    const selectedStyles = computed(() => {
      const map: { [key: string]: StyleInfo } = {};
      props.downloadInfos.forEach((downloadInfo) => {
        const styleInfo =
          downloadInfo.downloadableModel.speakerInfo.styleInfos[
            selectedStyleIndexes.value[
              downloadInfo.downloadableModel.speaker.speakerUuid
            ]
          ];
        const style =
          downloadInfo.downloadableModel.speaker.styles[
            selectedStyleIndexes.value[
              downloadInfo.downloadableModel.speaker.speakerUuid
            ]
          ];
        map[downloadInfo.downloadableModel.speaker.speakerUuid] = {
          styleName: style.name,
          styleId: style.id,
          iconPath: styleInfo.icon,
          voiceSamplePaths: styleInfo.voiceSamples,
        };
      });
      return map;
    });

    // 選択中のキャラクター
    const selectedCharacter = ref("");
    const selectCharacter = (speakerUuid: string) => {
      selectedCharacter.value = speakerUuid;
    };

    watch(
      () => props.modelValue,
      () => {
        sampleCharacterOrder.value = [
          ...props.downloadInfos.map(
            (info) => info.downloadableModel.speaker.speakerUuid
          ),
        ];
        selectedCharacter.value = sampleCharacterOrder.value[0];
      }
    );

    // キャラクター枠のホバー状態を表示するかどうか
    // 再生ボタンなどにカーソルがある場合はキャラクター枠のホバーUIを表示しないようにするため
    const isHoverableItem = ref(true);

    // 音声再生
    const playing = ref<{ styleId: number; index: number }>();

    const audio = new Audio();
    audio.volume = 0.5;
    audio.onended = () => stop();

    const play = ({ styleId, voiceSamplePaths }: StyleInfo, index: number) => {
      if (audio.src !== "") stop();

      audio.src = "data:audio/wav;base64," + voiceSamplePaths[index];
      audio.play();
      playing.value = { styleId, index };
    };
    const stop = () => {
      if (audio.src === "") return;

      audio.pause();
      audio.removeAttribute("src");
      playing.value = undefined;
    };

    // 再生していたら停止、再生していなかったら再生
    const togglePlayOrStop = (styleInfo: StyleInfo, index: number) => {
      if (
        playing.value === undefined ||
        styleInfo.styleId !== playing.value.styleId ||
        index !== playing.value.index
      ) {
        play(styleInfo, index);
      } else {
        stop();
      }
    };

    // スタイル番号をずらす
    const rollStyleIndex = (speakerUuid: string, diff: number) => {
      // 0 <= index <= length に収める
      const length = speakerInfosMap.value[speakerUuid].styleInfos.length;
      let styleIndex = selectedStyleIndexes.value[speakerUuid] + diff;
      styleIndex = styleIndex < 0 ? length - 1 : styleIndex % length;
      selectedStyleIndexes.value[speakerUuid] = styleIndex;

      // 音声を再生する。同じstyleIndexだったら停止する。
      const selectedStyleInfo = {
        styleName: speakersMap.value[speakerUuid].name,
        styleId: speakersMap.value[speakerUuid].styles[styleIndex].id,
        iconPath:
          speakerInfosMap.value[speakerUuid].styleInfos[styleIndex].icon,
        voiceSamplePaths:
          speakerInfosMap.value[speakerUuid].styleInfos[styleIndex]
            .voiceSamples,
      };
      togglePlayOrStop(selectedStyleInfo, 0);
    };

    const downloadInfosMap = computed(() => {
      const map: { [key: string]: DownloadInfo } = {};
      props.downloadInfos.forEach((downloadInfo) => {
        map[downloadInfo.downloadableModel.speaker.speakerUuid] = downloadInfo;
      });
      return map;
    });

    let downloadedMap = computed(() => {
      const map: { [key: string]: boolean } = {};
      props.downloadInfos.forEach((downloadInfo) => {
        map[downloadInfo.downloadableModel.speaker.speakerUuid] = false;
      });
      return map;
    });

    let downloadErrorMap = computed(() => {
      const map: { [key: string]: boolean } = {};
      props.downloadInfos.forEach((downloadInfo) => {
        map[downloadInfo.downloadableModel.speaker.speakerUuid] = false;
      });
      return map;
    });

    let downloadedPercent = ref("0 %");
    let isDownloading = ref(false);
    let downloadingUuid = ref("");
    const downloadCharacter = async (speakerUuid: string) => {
      if (isDownloading.value) return -1;
      isDownloading.value = true;
      downloadingUuid.value = speakerUuid;
      const appDirPath = await window.electron.appDirPath();
      const zipPath =
        appDirPath +
        "/speaker_info/" +
        speakerUuid +
        "_" +
        downloadInfosMap.value[speakerUuid].downloadableModel.speaker.version +
        ".zip";
      fetch(
        downloadInfosMap.value[speakerUuid].downloadableModel.downloadPath,
        {
          method: "GET",
        }
      )
        .then(async (res) => {
          if (await window.electron.checkFileExists(zipPath)) return undefined;
          if (speakerUuid.match("/")) throw new Error("不正なuuid");
          const reader = res.body?.getReader();
          const contentLength = Number(res.headers?.get("Content-Length"));
          let receivedLength = 0;
          const chunksAll = new Uint8Array(contentLength);
          let position = 0;
          while (reader) {
            const { done, value } = await reader.read();
            if (value) {
              receivedLength += value.length;
              chunksAll.set(value, position);
              position += value.length;
            }
            downloadedPercent.value =
              String(
                Math.floor((receivedLength / contentLength) * 10000) / 100
              ) + " %";
            if (done && chunksAll.length === position) break;
          }
          return chunksAll;
        })
        .then(async (chunksAll) => {
          if (!chunksAll) return undefined;
          downloadedPercent.value = "zip保存中";
          await window.electron.writeFile({
            filePath: zipPath,
            buffer: await chunksAll.buffer,
          });
        })
        .then(async () => {
          await window.electron.removeFile({
            filePath: appDirPath + "/speaker_info/" + speakerUuid,
          });
        })
        .then(async () => {
          downloadedPercent.value = "解凍中";
          const data = unzipSync(
            new Uint8Array(
              await window.electron.readFile({
                filePath: zipPath,
              })
            )
          );
          Object.entries(data).forEach(([filename, data]) => {
            window.electron.writeSpeakerFile({
              filePath: appDirPath + "/speaker_info/" + filename,
              buffer: data.buffer,
            });
          });
        })
        .then(async () => {
          await window.electron.removeFile({
            filePath: zipPath,
          });
        })
        .then(() => {
          isDownloading.value = false;
          downloadedMap.value[speakerUuid] = true;
          downloadedPercent.value = "0 %";
        })
        .catch((e) => {
          console.log(e);
          isDownloading.value = false;
          downloadedMap.value[speakerUuid] = true;
          downloadErrorMap.value[speakerUuid] = true;
          downloadedPercent.value = "0 %";
        });
    };

    const closeDialog = () => {
      stop();
      modelValueComputed.value = false;
    };

    return {
      modelValueComputed,
      speakerInfosMap,
      speakersMap,
      sampleCharacterOrder,
      selectedStyleIndexes,
      selectedStyles,
      selectedCharacter,
      selectCharacter,
      isHoverableItem,
      playing,
      togglePlayOrStop,
      rollStyleIndex,
      downloadCharacter,
      closeDialog,
      downloadInfosMap,
      downloadedPercent,
      isDownloading,
      downloadingUuid,
      downloadedMap,
      downloadErrorMap,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles/variables' as vars;
@use '@/styles/colors' as colors;

.q-toolbar div:first-child {
  min-width: 0;
}

.main {
  height: calc(
    100vh - #{vars.$menubar-height + vars.$header-height +
      vars.$window-border-width}
  );

  display: flex;
  flex-direction: row;
}

.character-items-container {
  height: 100%;
  padding: 5px 16px;

  flex-grow: 1;

  display: flex;
  flex-direction: column;
  overflow-y: scroll;

  > div {
    $character-item-size: 300px;
    display: grid;
    grid-template-columns: repeat(auto-fit, $character-item-size);
    grid-auto-rows: $character-item-size;
    column-gap: 10px;
    row-gap: 10px;
    align-content: center;
    justify-content: center;
    .character-item {
      box-shadow: 0 0 0 1px rgba(colors.$primary-light-rgb, 0.5);
      border-radius: 10px;
      overflow: hidden;
      &.selected-character-item {
        box-shadow: 0 0 0 2px colors.$primary-light;
      }
      &:hover :deep(.q-focus-helper) {
        opacity: 0 !important;
      }
      &.hoverable-character-item:hover :deep(.q-focus-helper) {
        opacity: 0.15 !important;
      }
      .character-item-inner {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
        .style-icon {
          $icon-size: $character-item-size / 3;
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
        .download-button {
          border-radius: 5px;
        }
        .detail {
          position: absolute;
          left: 0px;
          top: 0px;
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
  .q-page-container {
    padding-left: unset !important;
  }
}
</style>
