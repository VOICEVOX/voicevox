<template>
  <div class="root full-height q-py-md" v-show="activeAudioKey" v-if="query">
    <div class="q-px-md">
      <div class="row no-wrap">
        <div class="text-body1 q-mb-xs">プリセット</div>
        <q-space />

        <q-btn-dropdown dense flat icon="more_vert">
          <q-list>
            <q-item
              clickable
              v-close-popup
              @click="showsPresetNameDialog = true"
            >
              <q-item-section avatar>
                <q-avatar
                  icon="add_circle_outline"
                  color="primary"
                  text-color="secondary"
                ></q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>プリセット登録</q-item-label>
                <q-item-label caption
                  >現在の設定をプリセットに追加
                </q-item-label>
              </q-item-section>
            </q-item>
            <q-item
              clickable
              v-close-popup
              @click="showsPresetEditDialog = true"
            >
              <q-item-section avatar>
                <q-avatar
                  icon="edit_note"
                  color="primary"
                  text-color="secondary"
                ></q-avatar>
              </q-item-section>
              <q-item-section>
                <q-item-label>プリセット管理</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
        </q-btn-dropdown>
      </div>

      <div
        class="no-margin no-padding full-width"
        @wheel="setPresetByScroll($event.deltaY)"
      >
        <q-select
          v-model="presetSelectModel"
          :options="presetList"
          class="overflow-hidden"
          popup-content-class="text-secondary"
          outlined
          dense
        >
          <template v-slot:selected-item="scope">
            <div class="preset-select-label">
              {{ scope.opt.label }}
            </div>
          </template>
          <template v-slot:no-option>
            <q-item>
              <q-item-section class="text-grey">
                プリセットはありません
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
      <!-- プリセット管理ダイアログ -->
      <PresetManageDialog v-model:open-dialog="showsPresetEditDialog" />

      <!-- プリセット登録ダイアログ -->
      <q-dialog v-model="showsPresetNameDialog" @before-hide="closeAllDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">プリセット登録</div>
          </q-card-section>

          <q-form @submit.prevent="checkUpdate">
            <q-card-section class="q-pt-none">
              <q-input
                v-model="presetName"
                autofocus
                input-debounce="0"
                list="presetNameList"
                label="タイトル"
              >
                <datalist
                  id="presetNameList"
                  v-for="p in presetList"
                  :key="p.key"
                >
                  <option :value="p.label" />
                </datalist>
              </q-input>
            </q-card-section>

            <q-card-actions align="right" class="text-secondary">
              <q-btn
                flat
                label="キャンセル"
                @click="closeAllDialog"
                v-close-popup
              />
              <q-btn flat type="submit" label="確定" />
            </q-card-actions>
          </q-form>
        </q-card>
      </q-dialog>

      <q-dialog
        v-model="showsPresetRewriteDialog"
        @before-hide="closeAllDialog()"
      >
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">プリセットの上書き</div>
            <div>同名のプリセットがあります。</div>
          </q-card-section>
          <q-card-section>
            <q-list>
              <q-item clickable class="no-margin" @click="updatePreset(true)">
                <q-item-section avatar>
                  <q-avatar icon="arrow_forward" text-color="blue" />
                </q-item-section>
                <q-item-section>
                  プリセットを上書きし、音声にも反映する
                </q-item-section>
              </q-item>
              <q-item clickable class="no-margin" @click="updatePreset(false)">
                <q-item-section avatar>
                  <q-avatar icon="arrow_forward" text-color="blue" />
                </q-item-section>
                <q-item-section>
                  プリセットを上書きするが、音声には反映しない
                </q-item-section>
              </q-item>
              <q-item
                clickable
                class="no-margin"
                @click="closeAllDialog"
                v-close-popup
              >
                <q-item-section avatar>
                  <q-avatar icon="arrow_forward" text-color="blue" />
                </q-item-section>
                <q-item-section>キャンセル</q-item-section>
              </q-item>
            </q-list>
          </q-card-section>
        </q-card>
      </q-dialog>
    </div>

    <div class="q-mx-md">
      <span class="text-body1 q-mb-xs"
        >話速 {{ previewAudioSpeedScale.currentValue.value.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0.5"
        :max="2"
        :step="0.1"
        :disable="uiLocked"
        :model-value="previewAudioSpeedScale.currentValue.value"
        @update:model-value="setPreviewValue(previewAudioSpeedScale, $event)"
        @change="setAudioSpeedScale"
        @wheel="uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'speed')"
        @pan="setPanning(previewAudioSpeedScale, $event)"
      >
      </q-slider>
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音高 {{ previewAudioPitchScale.currentValue.value.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="-0.15"
        :max="0.15"
        :step="0.01"
        :disable="uiLocked"
        :model-value="previewAudioPitchScale.currentValue.value"
        @update:model-value="setPreviewValue(previewAudioPitchScale, $event)"
        @change="setAudioPitchScale"
        @wheel="uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'pitch')"
        @pan="setPanning(previewAudioPitchScale, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >抑揚
        {{ previewAudioIntonationScale.currentValue.value.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.01"
        :disable="uiLocked"
        :model-value="previewAudioIntonationScale.currentValue.value"
        @update:model-value="
          setPreviewValue(previewAudioIntonationScale, $event)
        "
        @change="setAudioIntonationScale"
        @wheel="uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'into')"
        @pan="setPanning(previewAudioIntonationScale, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音量 {{ previewAudioVolumeScale.currentValue.value.toFixed(1) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.1"
        :disable="uiLocked"
        :model-value="previewAudioVolumeScale.currentValue.value"
        @update:model-value="setPreviewValue(previewAudioVolumeScale, $event)"
        @change="setAudioVolumeScale"
        @wheel="
          uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'volume')
        "
        @pan="setPanning(previewAudioVolumeScale, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >開始無音
        {{ previewAudioPrePhonemeLength.currentValue.value.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="1.5"
        :step="0.1"
        :disable="uiLocked"
        :model-value="previewAudioPrePhonemeLength.currentValue.value"
        @update:model-value="
          setPreviewValue(previewAudioPrePhonemeLength, $event)
        "
        @change="setAudioPrePhonemeLength"
        @wheel="
          uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'prePhoneme')
        "
        @pan="setPanning(previewAudioPrePhonemeLength, $event)"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >終了無音
        {{ previewAudioPostPhonemeLength.currentValue.value.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="1.5"
        :step="0.1"
        :disable="uiLocked"
        :model-value="previewAudioPostPhonemeLength.currentValue.value"
        @update:model-value="
          setPreviewValue(previewAudioPostPhonemeLength, $event)
        "
        @change="setAudioPostPhonemeLength"
        @wheel="
          uiLocked || setAudioInfoByScroll(query, $event.deltaY, 'postPhoneme')
        "
        @pan="setPanning(previewAudioPostPhonemeLength, $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref, watch } from "vue";
import { useStore } from "@/store";
import { Preset } from "@/type/preload";
import { AudioQuery } from "@/openapi";
import { PreviewableValue } from "@/helpers/previewableValue";
import PresetManageDialog from "./PresetManageDialog.vue";
export default defineComponent({
  name: "AudioInfo",

  components: {
    PresetManageDialog,
  },

  setup() {
    const store = useStore();

    // accent phrase
    const activeAudioKey = computed<string | undefined>(
      () => store.getters.ACTIVE_AUDIO_KEY
    );
    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const audioItem = computed(() =>
      activeAudioKey.value ? store.state.audioItems[activeAudioKey.value] : null
    );
    const query = computed(() => audioItem.value?.query);

    const previewAudioSpeedScale = new PreviewableValue(
      () => query.value?.speedScale
    );

    const previewAudioPitchScale = new PreviewableValue(
      () => query.value?.pitchScale
    );

    const previewAudioIntonationScale = new PreviewableValue(
      () => query.value?.intonationScale
    );

    const previewAudioVolumeScale = new PreviewableValue(
      () => query.value?.volumeScale
    );

    const previewAudioPrePhonemeLength = new PreviewableValue(
      () => query.value?.prePhonemeLength
    );

    const previewAudioPostPhonemeLength = new PreviewableValue(
      () => query.value?.postPhonemeLength
    );

    const setPreviewValue = (
      previewableValue: PreviewableValue,
      value: number
    ) => previewableValue.setPreviewValue(value);

    const setPanning = (
      previewableValue: PreviewableValue,
      panning: string
    ) => {
      if (panning === "start") {
        previewableValue.startPreview();
      } else {
        previewableValue.stopPreview();
      }
    };

    const setAudioSpeedScale = (speedScale: number) => {
      previewAudioSpeedScale.stopPreview();
      store.dispatch("COMMAND_SET_AUDIO_SPEED_SCALE", {
        audioKey: activeAudioKey.value!,
        speedScale,
      });
    };

    const setAudioPitchScale = (pitchScale: number) => {
      previewAudioPitchScale.stopPreview();
      store.dispatch("COMMAND_SET_AUDIO_PITCH_SCALE", {
        audioKey: activeAudioKey.value!,
        pitchScale,
      });
    };

    const setAudioIntonationScale = (intonationScale: number) => {
      previewAudioIntonationScale.stopPreview();
      store.dispatch("COMMAND_SET_AUDIO_INTONATION_SCALE", {
        audioKey: activeAudioKey.value!,
        intonationScale,
      });
    };

    const setAudioVolumeScale = (volumeScale: number) => {
      previewAudioVolumeScale.stopPreview();
      store.dispatch("COMMAND_SET_AUDIO_VOLUME_SCALE", {
        audioKey: activeAudioKey.value!,
        volumeScale,
      });
    };

    const setAudioPrePhonemeLength = (prePhonemeLength: number) => {
      previewAudioPrePhonemeLength.stopPreview();
      store.dispatch("COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH", {
        audioKey: activeAudioKey.value!,
        prePhonemeLength,
      });
    };

    const setAudioPostPhonemeLength = (postPhonemeLength: number) => {
      previewAudioPostPhonemeLength.stopPreview();
      store.dispatch("COMMAND_SET_AUDIO_POST_PHONEME_LENGTH", {
        audioKey: activeAudioKey.value!,
        postPhonemeLength,
      });
    };

    type InfoType =
      | "speed"
      | "pitch"
      | "into"
      | "volume"
      | "prePhoneme"
      | "postPhoneme";

    const setAudioInfoByScroll = (
      query: AudioQuery,
      delta_y: number,
      type: InfoType
    ) => {
      switch (type) {
        case "speed": {
          let curSpeed = query.speedScale - (delta_y > 0 ? 0.1 : -0.1);
          curSpeed = Math.round(curSpeed * 1e2) / 1e2;
          if (2 >= curSpeed && curSpeed >= 0.5) {
            setAudioSpeedScale(curSpeed);
          }
          break;
        }
        case "pitch": {
          let curPitch = query.pitchScale - (delta_y > 0 ? 0.01 : -0.01);
          curPitch = Math.round(curPitch * 1e2) / 1e2;
          if (0.15 >= curPitch && curPitch >= -0.15) {
            setAudioPitchScale(curPitch);
          }
          break;
        }
        case "into": {
          let curInto = query.intonationScale - (delta_y > 0 ? 0.1 : -0.1);
          curInto = Math.round(curInto * 1e1) / 1e1;
          if (2 >= curInto && curInto >= 0) {
            setAudioIntonationScale(curInto);
          }
          break;
        }
        case "volume": {
          let curVolume = query.volumeScale - (delta_y > 0 ? 0.1 : -0.1);
          curVolume = Math.round(curVolume * 1e1) / 1e1;
          if (2 >= curVolume && curVolume >= 0) {
            setAudioVolumeScale(curVolume);
          }
          break;
        }
        case "prePhoneme": {
          let curPrePhoneme =
            query.prePhonemeLength - (delta_y > 0 ? 0.1 : -0.1);
          curPrePhoneme = Math.round(curPrePhoneme * 1e2) / 1e2;
          if (1.5 >= curPrePhoneme && curPrePhoneme >= 0) {
            setAudioPrePhonemeLength(curPrePhoneme);
          }
          break;
        }
        case "postPhoneme": {
          let curPostPhoneme =
            query.postPhonemeLength - (delta_y > 0 ? 0.1 : -0.1);
          curPostPhoneme = Math.round(curPostPhoneme * 1e2) / 1e2;
          if (1.5 >= curPostPhoneme && curPostPhoneme >= 0) {
            setAudioPostPhonemeLength(curPostPhoneme);
          }
          break;
        }
        default:
          break;
      }
    };

    const presetItems = computed(() => store.state.presetItems);
    const presetKeys = computed(() => store.state.presetKeys);

    const speaker = computed(() => audioItem.value?.speaker);
    const audioPresetKey = computed(() => audioItem.value?.presetKey);

    const presetList = computed(() => {
      if (speaker.value === undefined) return undefined;
      return presetKeys.value[speaker.value]?.map((e) => ({
        label: presetItems.value[e].name,
        key: e,
      }));
    });

    const notSelectedPreset = {
      label: "プリセットを選択",
      key: undefined,
    };

    const presetSelectModel = computed({
      get: () => {
        if (
          speaker.value === undefined ||
          audioPresetKey.value === undefined ||
          presetItems.value[audioPresetKey.value] === undefined ||
          presetKeys.value[speaker.value] === undefined ||
          !presetKeys.value[speaker.value].includes(audioPresetKey.value)
        )
          return notSelectedPreset;
        return {
          label: presetItems.value[audioPresetKey.value].name,
          key: audioPresetKey.value,
        };
      },
      set: (newVal: { label: string; key: string | undefined }) => {
        onChangePreset(newVal);
      },
    });

    const onChangePreset = (e: {
      label: string;
      key: string | undefined;
    }): void => {
      store.dispatch("COMMAND_SET_AUDIO_PRESET", {
        audioKey: activeAudioKey.value!,
        presetKey: e.key,
      });
    };

    const showsPresetNameDialog = ref(false);
    const showsPresetRewriteDialog = ref(false);
    const presetName = ref("");

    const closeAllDialog = () => {
      presetName.value = "";
      showsPresetNameDialog.value = false;
      showsPresetRewriteDialog.value = false;
    };

    const showsPresetEditDialog = ref(false);

    const checkUpdate = () => {
      if (presetList.value?.find((e) => e.label === presetName.value)) {
        showsPresetRewriteDialog.value = true;
      } else {
        addPreset();
      }
    };
    const createPresetData = (title: string, speaker: number) =>
      ({
        name: title,
        speaker,
        speedScale: previewAudioSpeedScale.currentValue.value!,
        pitchScale: previewAudioPitchScale.currentValue.value!,
        intonationScale: previewAudioIntonationScale.currentValue.value!,
        volumeScale: previewAudioVolumeScale.currentValue.value!,
        prePhonemeLength: previewAudioPrePhonemeLength.currentValue.value!,
        postPhonemeLength: previewAudioPostPhonemeLength.currentValue.value!,
      } as Preset);

    const addPreset = () => {
      const title = presetName.value;
      presetName.value = "";

      if (audioItem.value?.speaker === undefined) return;
      const speaker = audioItem.value.speaker;

      const newPreset = createPresetData(title, speaker);

      store.dispatch("ADD_PRESET", {
        presetData: newPreset,
        audioKey: activeAudioKey.value,
      });

      closeAllDialog();
    };

    const updatePreset = (updatesAudioItems: boolean) => {
      const key = presetList.value?.find(
        (e) => e.label === presetName.value
      )?.key;
      if (key === undefined) return;

      const title = presetName.value;
      if (audioItem.value?.speaker === undefined) return;
      const speaker = audioItem.value.speaker;
      const newPreset = createPresetData(title, speaker);

      store.dispatch("UPDATE_PRESET", {
        presetData: newPreset,
        oldKey: key,
        updatesAudioItems,
        audioKey: activeAudioKey.value,
      });
      presetName.value = "";
      closeAllDialog();
    };

    const setPresetByScroll = (deltaY: number) => {
      if (speaker.value === undefined) return;

      const presetNumber = presetList.value?.length;
      if (presetNumber === 0 || presetNumber === undefined) return;

      let nowIndex: number;
      if (presetSelectModel.value.key === undefined) {
        nowIndex = -1;
      } else {
        nowIndex = presetKeys.value[speaker.value].indexOf(
          presetSelectModel.value.key
        );
      }

      const isUp = deltaY > 0;
      const newIndex = isUp ? nowIndex + 1 : nowIndex - 1;
      if (newIndex < 0 || presetNumber <= newIndex) return;

      if (
        presetList.value === undefined ||
        presetList.value[newIndex] === undefined
      )
        return;

      onChangePreset(presetList.value[newIndex]);
    };

    const presetLabelList = computed(() =>
      presetList.value?.map((e) => e.label)
    );
    const filterOptions = ref(presetLabelList.value);

    const createValue = (
      val: string,
      done: (item: string, mode: string) => void
    ) => {
      if (!presetLabelList.value!.includes(val)) {
        done(val, "add-unique");
      }
    };

    const presetNamefilter = (
      val: string,
      update: (callback: () => void) => void
    ) => {
      update(() => {
        if (val === "") {
          filterOptions.value = presetLabelList.value;
        } else {
          const needle = val.toLowerCase();
          filterOptions.value = presetLabelList.value!.filter(
            (v) => v.toLowerCase().indexOf(needle) > -1
          );
        }
      });
    };

    return {
      activeAudioKey,
      uiLocked,
      audioItem,
      query,
      previewAudioSpeedScale,
      previewAudioPitchScale,
      previewAudioIntonationScale,
      previewAudioVolumeScale,
      previewAudioPrePhonemeLength,
      previewAudioPostPhonemeLength,
      setPreviewValue,
      setAudioSpeedScale,
      setAudioPitchScale,
      setAudioIntonationScale,
      setAudioVolumeScale,
      setAudioPrePhonemeLength,
      setAudioPostPhonemeLength,
      setAudioInfoByScroll,
      setPanning,
      presetList,
      presetSelectModel,
      setPresetByScroll,
      checkUpdate,
      updatePreset,
      showsPresetNameDialog,
      presetName,
      closeAllDialog,
      showsPresetEditDialog,
      createValue,
      filterOptions,
      presetNamefilter,
      showsPresetRewriteDialog,
    };
  },
});
</script>

<style scoped lang="scss">
@use '@/styles' as global;

.root {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  gap: 15px 0;
  overflow-y: scroll;
}

.preset-select-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: fit-content;
  max-width: 8rem;
}
</style>
