<template>
  <div class="root full-height q-py-sm" v-show="activeAudioKey" v-if="query">
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs">presetList</span>
      <p>{{ presetList }}</p>

      <div class="row no-wrap full-width">
        <div
          class="no-margin no-padding full-width"
          @wheel="setPresetByScroll($event.deltaY)"
        >
          <q-select
            v-model="presetSelectModel"
            :options="presetList"
            class="overflow-hidden"
            outlined
            dense
            @update:model-value="onChangePreset"
          >
            <template v-slot:selected-item="scope">
              <div class="preset-select-label">
                {{ scope.opt.label }}
              </div>
            </template>
          </q-select>
        </div>

        <q-btn
          icon="add_circle_outline"
          unelevated
          flat
          padding="0.5rem"
          @click="() => (showsPresetNameDialog = true)"
        ></q-btn>
      </div>

      <q-dialog v-model="showsPresetNameDialog" persistent>
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">プリセット名</div>
          </q-card-section>

          <q-card-section class="q-pt-none">
            <q-input
              dense
              v-model="presetName"
              autofocus
              @keyup.enter="addPreset()"
              v-close-popup
            />
          </q-card-section>

          <q-card-actions align="right" class="text-primary">
            <q-btn flat label="キャンセル" v-close-popup />
            <q-btn flat label="確定" @click="addPreset()" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

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
        <template v-slot:no-option>
          <q-item>
            <q-item-section class="text-italic text-grey">
              プリセットはありません
            </q-item-section>
          </q-item>
        </template>
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
        >無音時間（前）
        {{ previewAudioPrePhonemeLength.currentValue.value.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.05"
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
        >無音時間（後）
        {{ previewAudioPostPhonemeLength.currentValue.value.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        :min="0"
        :max="2"
        :step="0.05"
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
import { computed, defineComponent, ref } from "vue";
import { useStore } from "@/store";
import {
  ACTIVE_AUDIO_KEY,
  COMMAND_SET_AUDIO_INTONATION_SCALE,
  COMMAND_SET_AUDIO_PITCH_SCALE,
  COMMAND_SET_AUDIO_SPEED_SCALE,
  COMMAND_SET_AUDIO_VOLUME_SCALE,
  COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH,
  COMMAND_SET_AUDIO_POST_PHONEME_LENGTH,
  COMMAND_SET_AUDIO_PRESET,
} from "@/store/audio";
import { UI_LOCKED } from "@/store/ui";
import { Preset } from "@/type/preload";
import { SAVE_PRESETS } from "@/store/preset";
import { AudioQuery } from "@/openapi";
import { PreviewableValue } from "@/helpers/previewableValue";

export default defineComponent({
  name: "AudioInfo",

  setup() {
    const store = useStore();

    // accent phrase
    const activeAudioKey = computed<string | null>(
      () => store.getters[ACTIVE_AUDIO_KEY]
    );
    const uiLocked = computed(() => store.getters[UI_LOCKED]);

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
      store.dispatch(COMMAND_SET_AUDIO_SPEED_SCALE, {
        audioKey: activeAudioKey.value!,
        speedScale,
      });
      onChangeParameter();
    };

    const setAudioPitchScale = (pitchScale: number) => {
      previewAudioPitchScale.stopPreview();
      store.dispatch(COMMAND_SET_AUDIO_PITCH_SCALE, {
        audioKey: activeAudioKey.value!,
        pitchScale,
      });
      onChangeParameter();
    };

    const setAudioIntonationScale = (intonationScale: number) => {
      previewAudioIntonationScale.stopPreview();
      store.dispatch(COMMAND_SET_AUDIO_INTONATION_SCALE, {
        audioKey: activeAudioKey.value!,
        intonationScale,
      });
      onChangeParameter();
    };

    const setAudioVolumeScale = (volumeScale: number) => {
      previewAudioVolumeScale.stopPreview();
      store.dispatch(COMMAND_SET_AUDIO_VOLUME_SCALE, {
        audioKey: activeAudioKey.value!,
        volumeScale,
      });
      onChangeParameter();
    };

    const setAudioPrePhonemeLength = (prePhonemeLength: number) => {
      previewAudioPrePhonemeLength.stopPreview();
      store.dispatch(COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH, {
        audioKey: activeAudioKey.value!,
        prePhonemeLength,
      });
    };

    const setAudioPostPhonemeLength = (postPhonemeLength: number) => {
      previewAudioPostPhonemeLength.stopPreview();
      store.dispatch(COMMAND_SET_AUDIO_POST_PHONEME_LENGTH, {
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
            query.prePhonemeLength - (delta_y > 0 ? 0.05 : -0.05);
          curPrePhoneme = Math.round(curPrePhoneme * 1e2) / 1e2;
          if (2 >= curPrePhoneme && curPrePhoneme >= 0) {
            setAudioPrePhonemeLength(curPrePhoneme);
          }
          break;
        }
        case "postPhoneme": {
          let curPostPhoneme =
            query.postPhonemeLength - (delta_y > 0 ? 0.05 : -0.05);
          curPostPhoneme = Math.round(curPostPhoneme * 1e2) / 1e2;
          if (2 >= curPostPhoneme && curPostPhoneme >= 0) {
            setAudioPostPhonemeLength(curPostPhoneme);
          }
          break;
        }
        default:
          break;
      }
    };

    const presetList = computed<{ label: string; value: number }[] | undefined>(
      () =>
        audioItem.value?.characterIndex !== undefined
          ? store.state.presets?.[audioItem.value.characterIndex]?.map(
              (e, index) => ({
                label: e.name,
                value: index,
              })
            )
          : undefined
    );

    const presets = computed(() => store.state.presets);

    const notSelectedPreset = {
      label: "プリセットを選択",
      value: undefined,
    };

    const presetSelectModel =
      ref<{
        label: string;
        value: number | undefined;
      }>(notSelectedPreset);

    const onChangePreset = (e: {
      label: string;
      value: number | undefined;
    }): void => {
      if (audioItem.value?.characterIndex === undefined) return;

      store.dispatch(COMMAND_SET_AUDIO_PRESET, {
        audioId: activeAudioKey.value,
        characterIndex: audioItem.value.characterIndex,
        presetIndex: e.value,
      });

      presetSelectModel.value = e;
    };

    const showsPresetNameDialog = ref(false);
    const presetName = ref("");

    const onChangeParameter = () => {
      presetSelectModel.value = notSelectedPreset;
    };

    const addPreset = () => {
      console.log("addPreset");

      if (audioItem.value?.characterIndex === undefined) return;
      const characterIndex = audioItem.value.characterIndex;

      const newPreset = {
        name: presetName.value,
        charactorIndex: characterIndex,
        speedScale: previewAudioSpeedScale.currentValue.value!,
        pitchScale: previewAudioPitchScale.currentValue.value!,
        intonationScale: previewAudioIntonationScale.currentValue.value!,
        volumeScale: previewAudioVolumeScale.currentValue.value!,
      } as Preset;

      const charaPreset =
        presets.value !== undefined &&
        presets.value[characterIndex] !== undefined
          ? (JSON.parse(
              JSON.stringify(presets.value[characterIndex])
            ) as Preset[])
          : [];

      charaPreset.push(newPreset);

      store.dispatch(SAVE_PRESETS, {
        characterIndex,
        presetsData: charaPreset,
      });

      presetSelectModel.value = {
        label: newPreset.name,
        value: charaPreset.length - 1,
    };

      showsPresetNameDialog.value = false;
      presetName.value = "";
    };

    const setPresetByScroll = (deltaY: number) => {
      const isUp = deltaY > 0;
      const presetNumber = presetList.value?.length;
      const nowIndex = presetSelectModel.value.value ?? -1;

      if (presetNumber === 0 || presetNumber === undefined) return;

      const newIndex = isUp ? nowIndex + 1 : nowIndex - 1;
      if (newIndex < 0 || presetNumber <= newIndex) return;

      if (
        presetList.value === undefined ||
        presetList.value[newIndex] === undefined
      )
        return;
      presetSelectModel.value = presetList.value[newIndex];
      onChangePreset(presetList.value[newIndex]);
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
      onChangePreset,
      addPreset,
      presets,
      showsPresetNameDialog,
      presetName,
      setPresetByScroll,
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
  justify-content: flex-end;
  gap: 15px 0;
  overflow: hidden;
  bottom: 0;
}

.preset-select-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: fit-content;
  max-width: 8rem;
}
</style>
