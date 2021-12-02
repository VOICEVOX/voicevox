<template>
  <div class="root full-height q-py-md" v-if="query">
    <div class="q-px-md">
      <div class="row no-wrap">
        <div class="text-body1 q-mb-xs">プリセット</div>
        <q-space />

        <q-btn-dropdown dense flat icon="more_vert">
          <q-list>
            <q-item clickable v-close-popup @click="registerPreset">
              <q-item-section avatar>
                <q-avatar
                  icon="add_circle_outline"
                  color="primary-light"
                  text-color="display-dark"
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
                  color="primary-light"
                  text-color="display-dark"
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
          :options="selectablePresetList"
          class="overflow-hidden"
          color="primary-light"
          text-color="display-dark"
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

          <q-form @submit.prevent="checkRewrite">
            <q-card-section class="q-pt-none" text-color="display-dark">
              <q-select
                fill-input
                autofocus
                hide-selected
                label="タイトル"
                label-color="display-dark"
                color="primary-light"
                use-input
                input-debounce="0"
                :model-value="presetName"
                :options="presetOptionsList"
                @input-value="setPresetName"
                @filter="filterPresetOptionsList"
              />
            </q-card-section>

            <q-card-actions align="right" text-color="display-dark">
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

      <!-- プリセット上書きダイアログ -->
      <q-dialog
        v-model="showsPresetRewriteDialog"
        @before-hide="closeAllDialog"
      >
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">プリセットの上書き</div>
            <div>同名のプリセットがあります。</div>
          </q-card-section>
          <q-card-section>
            <q-list>
              <q-item clickable class="no-margin" @click="updatePreset">
                <q-item-section avatar>
                  <q-avatar icon="arrow_forward" text-color="blue" />
                </q-item-section>
                <q-item-section> プリセットを上書きする． </q-item-section>
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
        >話速 {{ speedScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        :min="speedScaleSlider.qSliderProps.min.value"
        :max="speedScaleSlider.qSliderProps.max.value"
        :step="speedScaleSlider.qSliderProps.step.value"
        :disable="speedScaleSlider.qSliderProps.disable.value"
        :model-value="speedScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          speedScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="speedScaleSlider.qSliderProps.onChange"
        @wheel="speedScaleSlider.qSliderProps.onWheel"
        @pan="speedScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音高 {{ pitchScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        :min="pitchScaleSlider.qSliderProps.min.value"
        :max="pitchScaleSlider.qSliderProps.max.value"
        :step="pitchScaleSlider.qSliderProps.step.value"
        :disable="pitchScaleSlider.qSliderProps.disable.value"
        :model-value="pitchScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          pitchScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="pitchScaleSlider.qSliderProps.onChange"
        @wheel="pitchScaleSlider.qSliderProps.onWheel"
        @pan="pitchScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >抑揚
        {{ intonationScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        :min="intonationScaleSlider.qSliderProps.min.value"
        :max="intonationScaleSlider.qSliderProps.max.value"
        :step="intonationScaleSlider.qSliderProps.step.value"
        :disable="intonationScaleSlider.qSliderProps.disable.value"
        :model-value="intonationScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          intonationScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="intonationScaleSlider.qSliderProps.onChange"
        @wheel="intonationScaleSlider.qSliderProps.onWheel"
        @pan="intonationScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >音量 {{ volumeScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        :min="volumeScaleSlider.qSliderProps.min.value"
        :max="volumeScaleSlider.qSliderProps.max.value"
        :step="volumeScaleSlider.qSliderProps.step.value"
        :disable="volumeScaleSlider.qSliderProps.disable.value"
        :model-value="volumeScaleSlider.qSliderProps.modelValue.value"
        @update:model-value="
          volumeScaleSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="volumeScaleSlider.qSliderProps.onChange"
        @wheel="volumeScaleSlider.qSliderProps.onWheel"
        @pan="volumeScaleSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >開始無音
        {{ prePhonemeLengthSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        :min="prePhonemeLengthSlider.qSliderProps.min.value"
        :max="prePhonemeLengthSlider.qSliderProps.max.value"
        :step="prePhonemeLengthSlider.qSliderProps.step.value"
        :disable="prePhonemeLengthSlider.qSliderProps.disable.value"
        :model-value="prePhonemeLengthSlider.qSliderProps.modelValue.value"
        @update:model-value="
          prePhonemeLengthSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="prePhonemeLengthSlider.qSliderProps.onChange"
        @wheel="prePhonemeLengthSlider.qSliderProps.onWheel"
        @pan="prePhonemeLengthSlider.qSliderProps.onPan"
      />
    </div>
    <div class="q-px-md">
      <span class="text-body1 q-mb-xs"
        >終了無音
        {{ postPhonemeLengthSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        :min="postPhonemeLengthSlider.qSliderProps.min.value"
        :max="postPhonemeLengthSlider.qSliderProps.max.value"
        :step="postPhonemeLengthSlider.qSliderProps.step.value"
        :disable="postPhonemeLengthSlider.qSliderProps.disable.value"
        :model-value="postPhonemeLengthSlider.qSliderProps.modelValue.value"
        @update:model-value="
          postPhonemeLengthSlider.qSliderProps['onUpdate:modelValue']
        "
        @change="postPhonemeLengthSlider.qSliderProps.onChange"
        @wheel="postPhonemeLengthSlider.qSliderProps.onWheel"
        @pan="postPhonemeLengthSlider.qSliderProps.onPan"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from "vue";
import { QSelectProps } from "quasar";
import { useStore } from "@/store";

import { Preset } from "@/type/preload";
import { previewSliderHelper } from "@/helpers/previewSliderHelper";
import PresetManageDialog from "./PresetManageDialog.vue";

export default defineComponent({
  name: "AudioInfo",

  components: {
    PresetManageDialog,
  },

  props: {
    activeAudioKey: { type: String, required: true },
  },

  setup(props) {
    const store = useStore();

    // accent phrase
    const uiLocked = computed(() => store.getters.UI_LOCKED);

    const audioItem = computed(
      () => store.state.audioItems[props.activeAudioKey]
    );
    const query = computed(() => audioItem.value?.query);

    const setAudioSpeedScale = (speedScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_SPEED_SCALE", {
        audioKey: props.activeAudioKey,
        speedScale,
      });
    };

    const setAudioPitchScale = (pitchScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_PITCH_SCALE", {
        audioKey: props.activeAudioKey,
        pitchScale,
      });
    };

    const setAudioIntonationScale = (intonationScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_INTONATION_SCALE", {
        audioKey: props.activeAudioKey,
        intonationScale,
      });
    };

    const setAudioVolumeScale = (volumeScale: number) => {
      store.dispatch("COMMAND_SET_AUDIO_VOLUME_SCALE", {
        audioKey: props.activeAudioKey,
        volumeScale,
      });
    };

    const setAudioPrePhonemeLength = (prePhonemeLength: number) => {
      store.dispatch("COMMAND_SET_AUDIO_PRE_PHONEME_LENGTH", {
        audioKey: props.activeAudioKey,
        prePhonemeLength,
      });
    };

    const setAudioPostPhonemeLength = (postPhonemeLength: number) => {
      store.dispatch("COMMAND_SET_AUDIO_POST_PHONEME_LENGTH", {
        audioKey: props.activeAudioKey,
        postPhonemeLength,
      });
    };

    const speedScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.speedScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioSpeedScale,
      max: () => 2,
      min: () => 0.5,
      step: () => 0.01,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const pitchScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.pitchScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPitchScale,
      max: () => 0.15,
      min: () => -0.15,
      step: () => 0.01,
      scrollStep: () => 0.01,
    });
    const intonationScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.intonationScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioIntonationScale,
      max: () => 2,
      min: () => 0,
      step: () => 0.01,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const volumeScaleSlider = previewSliderHelper({
      modelValue: () => query.value?.volumeScale ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioVolumeScale,
      max: () => 2,
      min: () => 0,
      step: () => 0.01,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const prePhonemeLengthSlider = previewSliderHelper({
      modelValue: () => query.value?.prePhonemeLength ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPrePhonemeLength,
      max: () => 1.5,
      min: () => 0,
      step: () => 0.01,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });
    const postPhonemeLengthSlider = previewSliderHelper({
      modelValue: () => query.value?.postPhonemeLength ?? null,
      disable: () => uiLocked.value,
      onChange: setAudioPostPhonemeLength,
      max: () => 1.5,
      min: () => 0,
      step: () => 0.01,
      scrollStep: () => 0.1,
      scrollMinStep: () => 0.01,
    });

    const presetItems = computed(() => store.state.presetItems);
    const presetKeys = computed(() => store.state.presetKeys);
    const audioPresetKey = computed(() => audioItem.value?.presetKey);

    const changePreset = (preset: {
      label: string;
      key: string | undefined;
    }): void => {
      store.dispatch("COMMAND_SET_AUDIO_PRESET", {
        audioKey: props.activeAudioKey,
        presetKey: preset.key,
      });
    };

    const presetList = computed<{ label: string; key: string }[]>(() =>
      presetKeys.value
        .filter((key) => presetItems.value[key] != undefined)
        .map((key) => ({
          key,
          label: presetItems.value[key].name,
        }))
    );

    // セルへのプリセットの設定
    const selectablePresetList = computed<
      { label: string; key: string | undefined }[]
    >(() => [
      {
        key: undefined,
        label: "プリセット解除",
      },
      ...presetList.value,
    ]);

    const presetSelectModel = computed<{
      label: string;
      key: string | undefined;
    }>({
      get: () => {
        if (
          audioPresetKey.value === undefined ||
          !presetKeys.value.includes(audioPresetKey.value) ||
          presetItems.value[audioPresetKey.value] == undefined
        )
          return {
            label: "プリセットを選択",
            key: undefined,
          };
        return {
          label: presetItems.value[audioPresetKey.value].name,
          key: audioPresetKey.value,
        };
      },
      set: (newVal) => {
        changePreset(newVal);
      },
    });

    const setPresetByScroll = (deltaY: number) => {
      const presetNumber = selectablePresetList.value.length;
      if (presetNumber === 0 || presetNumber === undefined) return;

      const nowIndex = selectablePresetList.value.findIndex(
        (value) => value.key == presetSelectModel.value.key
      );

      const isUp = deltaY > 0;
      const newIndex = isUp ? nowIndex + 1 : nowIndex - 1;
      if (newIndex < 0 || presetNumber <= newIndex) return;

      if (selectablePresetList.value[newIndex] === undefined) return;

      changePreset(selectablePresetList.value[newIndex]);
    };

    // プリセットの登録・上書き
    const showsPresetNameDialog = ref(false);
    const showsPresetRewriteDialog = ref(false);
    const presetName = ref("");

    const setPresetName = (name: string) => {
      presetName.value = name;
    };

    const closeAllDialog = () => {
      presetName.value = "";
      showsPresetNameDialog.value = false;
      showsPresetRewriteDialog.value = false;
    };

    const registerPreset = () => {
      showsPresetNameDialog.value = true;
      if (
        audioPresetKey.value != undefined &&
        presetItems.value[audioPresetKey.value] != undefined
      ) {
        presetName.value = presetItems.value[audioPresetKey.value].name;
      }
    };

    const presetOptionsList = ref<string[]>([]);
    const filterPresetOptionsList: QSelectProps["onFilter"] = (
      inputValue,
      doneFn
    ) => {
      const presetNames = presetKeys.value
        .map((presetKey) => presetItems.value[presetKey]?.name)
        .filter((value) => value != undefined);
      doneFn(() => {
        presetOptionsList.value = presetNames.filter((name) =>
          name.startsWith(inputValue)
        );
      });
    };

    const checkRewrite = () => {
      if (presetList.value.find((e) => e.label === presetName.value)) {
        showsPresetRewriteDialog.value = true;
      } else {
        addPreset();
      }
    };

    const createPresetData = (title: string): Preset | undefined => {
      if (
        speedScaleSlider.state.currentValue.value == null ||
        pitchScaleSlider.state.currentValue.value == null ||
        intonationScaleSlider.state.currentValue.value == null ||
        volumeScaleSlider.state.currentValue.value == null ||
        prePhonemeLengthSlider.state.currentValue.value == null ||
        postPhonemeLengthSlider.state.currentValue.value == null
      )
        return undefined;
      return {
        name: title,
        speedScale: speedScaleSlider.state.currentValue.value,
        pitchScale: pitchScaleSlider.state.currentValue.value,
        intonationScale: intonationScaleSlider.state.currentValue.value,
        volumeScale: volumeScaleSlider.state.currentValue.value,
        prePhonemeLength: prePhonemeLengthSlider.state.currentValue.value,
        postPhonemeLength: postPhonemeLengthSlider.state.currentValue.value,
      };
    };

    const addPreset = () => {
      const title = presetName.value;
      const newPreset = createPresetData(title);
      if (newPreset == undefined) throw Error("newPreset == undefined");

      store.dispatch("ADD_PRESET", {
        presetData: newPreset,
      });

      closeAllDialog();
    };

    const updatePreset = () => {
      const key = presetList.value.find(
        (preset) => preset.label === presetName.value
      )?.key;
      if (key === undefined) return;

      const title = presetName.value;
      const newPreset = createPresetData(title);
      if (newPreset == undefined) return;

      store.dispatch("UPDATE_PRESET", {
        presetData: newPreset,
        presetKey: key,
      });

      closeAllDialog();
    };

    // プリセットの編集
    const showsPresetEditDialog = ref(false);

    return {
      uiLocked,
      audioItem,
      query,
      setAudioSpeedScale,
      setAudioPitchScale,
      setAudioIntonationScale,
      setAudioVolumeScale,
      setAudioPrePhonemeLength,
      setAudioPostPhonemeLength,
      presetList,
      selectablePresetList,
      presetOptionsList,
      filterPresetOptionsList,
      presetSelectModel,
      setPresetByScroll,
      checkRewrite,
      updatePreset,
      registerPreset,
      showsPresetNameDialog,
      presetName,
      closeAllDialog,
      showsPresetEditDialog,
      showsPresetRewriteDialog,
      setPresetName,
      speedScaleSlider,
      pitchScaleSlider,
      intonationScaleSlider,
      volumeScaleSlider,
      prePhonemeLengthSlider,
      postPhonemeLengthSlider,
    };
  },
});
</script>

<style scoped lang="scss">
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
