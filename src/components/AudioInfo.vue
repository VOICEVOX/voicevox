<template>
  <div class="root full-height q-py-md" v-if="query">
    <div v-if="enablePreset" class="q-px-md">
      <div class="row items-center no-wrap q-mb-xs">
        <div class="text-body1">プリセット</div>
        <q-btn dense flat icon="more_vert">
          <q-menu transition-duration="100">
            <q-list>
              <q-item
                clickable
                v-close-popup
                @click="registerPreset({ overwrite: false })"
              >
                <q-item-section avatar>
                  <q-avatar
                    icon="add_circle_outline"
                    color="primary-light"
                    text-color="display-dark"
                  ></q-avatar>
                </q-item-section>
                <q-item-section>
                  <q-item-label>プリセット新規登録</q-item-label>
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
          </q-menu>
        </q-btn>
      </div>

      <div class="full-width row" @wheel="setPresetByScroll($event)">
        <q-select
          v-model="presetSelectModel"
          :options="selectablePresetList"
          class="col overflow-hidden"
          color="primary-light"
          text-color="display-dark"
          outlined
          dense
          transition-show="none"
          transition-hide="none"
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

        <q-btn
          dense
          outline
          class="col-auto q-ml-xs"
          size="sm"
          text-color="display"
          :label="isRegisteredPreset ? '再登録' : '登録'"
          v-show="!isRegisteredPreset || isChangedPreset"
          @click="registerPreset({ overwrite: isRegisteredPreset })"
        />
      </div>
      <!-- プリセット管理ダイアログ -->
      <preset-manage-dialog v-model:open-dialog="showsPresetEditDialog" />

      <!-- プリセット登録ダイアログ -->
      <q-dialog v-model="showsPresetNameDialog" @before-hide="closeAllDialog">
        <q-card style="min-width: 350px">
          <q-card-section>
            <div class="text-h6">プリセット登録</div>
          </q-card-section>

          <q-form @submit.prevent="checkRewritePreset">
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

      <!-- プリセット再登録ダイアログ -->
      <q-dialog
        v-model="showsPresetRewriteDialog"
        @before-hide="closeAllDialog"
      >
        <q-card>
          <q-card-section>
            <div class="text-h6">プリセットの再登録</div>
          </q-card-section>
          <q-card-section>
            <q-list>
              <q-item clickable class="no-margin" @click="updatePreset(true)">
                <q-item-section avatar>
                  <q-avatar icon="arrow_forward" text-color="blue" />
                </q-item-section>
                <q-item-section>
                  プリセットを再登録し、このプリセットが設定されたテキスト欄全てに再適用する
                </q-item-section>
              </q-item>
              <q-item clickable class="no-margin" @click="updatePreset(false)">
                <q-item-section avatar>
                  <q-avatar icon="arrow_forward" text-color="blue" />
                </q-item-section>
                <q-item-section> プリセットの再登録のみ行う </q-item-section>
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

      <q-separator class="q-mt-md" />
    </div>

    <div class="q-mx-md">
      <span class="text-body1 q-mb-xs"
        >話速 {{ speedScaleSlider.state.currentValue.value?.toFixed(2) }}</span
      >
      <q-slider
        dense
        snap
        color="primary-light"
        trackSize="2px"
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
        trackSize="2px"
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
        trackSize="2px"
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
        trackSize="2px"
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
        trackSize="2px"
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
        trackSize="2px"
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

    const applyPreset = () => {
      store.dispatch("COMMAND_APPLY_AUDIO_PRESET", {
        audioKey: props.activeAudioKey,
      });
    };

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

    // プリセット
    const enablePreset = computed(
      () => store.state.experimentalSetting.enablePreset
    );

    const presetItems = computed(() => store.state.presetItems);
    const presetKeys = computed(() => store.state.presetKeys);
    const audioPresetKey = computed(() => audioItem.value?.presetKey);
    const isRegisteredPreset = computed(
      () =>
        audioPresetKey.value != undefined &&
        presetItems.value[audioPresetKey.value] != undefined
    );

    // 入力パラメータがプリセットから変更されたか
    const isChangedPreset = computed(() => {
      if (!isRegisteredPreset.value) return false;

      // プリセットの値を取得
      if (audioPresetKey.value == undefined)
        throw new Error("audioPresetKey is undefined"); // 次のコードが何故かコンパイルエラーになるチェック
      const preset = presetItems.value[audioPresetKey.value];
      const { name: _, ...presetParts } = preset;

      // 入力パラメータと比較
      const keys = Object.keys(presetParts) as (keyof Omit<Preset, "name">)[];
      return keys.some(
        (key) => presetParts[key] !== presetPartsFromParameter.value[key]
      );
    });

    type PresetSelectModelType = {
      label: string;
      key: string | undefined;
    };

    // プリセットの変更
    const changePreset = (
      presetOrPresetKey: PresetSelectModelType | string
    ): void => {
      const presetKey =
        typeof presetOrPresetKey === "string"
          ? presetOrPresetKey
          : presetOrPresetKey.key;
      store.dispatch("COMMAND_SET_AUDIO_PRESET", {
        audioKey: props.activeAudioKey,
        presetKey,
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
    const selectablePresetList = computed<PresetSelectModelType[]>(() => {
      const restPresetList = [];
      if (isRegisteredPreset.value) {
        restPresetList.push({
          key: undefined,
          label: "プリセット解除",
        });
      }
      return [...restPresetList, ...presetList.value];
    });

    const presetSelectModel = computed<PresetSelectModelType>({
      get: () => {
        if (!isRegisteredPreset.value)
          return {
            label: "プリセット選択",
            key: undefined,
          };

        if (audioPresetKey.value == undefined)
          throw new Error("audioPresetKey is undefined"); // 次のコードが何故かコンパイルエラーになるチェック
        return {
          label: presetItems.value[audioPresetKey.value].name,
          key: audioPresetKey.value,
        };
      },
      set: (newVal) => {
        changePreset(newVal);
      },
    });

    const setPresetByScroll = (event: WheelEvent) => {
      event.preventDefault();

      const presetNumber = selectablePresetList.value.length;
      if (presetNumber === 0 || presetNumber === undefined) return;

      const nowIndex = selectablePresetList.value.findIndex(
        (value) => value.key == presetSelectModel.value.key
      );

      const isUp = event.deltaY > 0;
      const newIndex = isUp ? nowIndex + 1 : nowIndex - 1;
      if (newIndex < 0 || presetNumber <= newIndex) return;

      if (selectablePresetList.value[newIndex] === undefined) return;

      changePreset(selectablePresetList.value[newIndex]);
    };

    // プリセットの登録・再登録
    const showsPresetNameDialog = ref(false);
    const showsPresetRewriteDialog = ref(false);
    const presetNameInDialog = ref("");

    const setPresetName = (name: string) => {
      presetNameInDialog.value = name;
    };

    const closeAllDialog = () => {
      presetNameInDialog.value = "";
      showsPresetNameDialog.value = false;
      showsPresetRewriteDialog.value = false;
    };

    // プリセットの登録
    const registerPreset = ({ overwrite }: { overwrite: boolean }) => {
      // 既存の場合は名前をセット
      if (isRegisteredPreset.value) {
        if (audioPresetKey.value == undefined)
          throw new Error("audioPresetKey is undefined"); // 次のコードが何故かコンパイルエラーになるチェック
        presetNameInDialog.value = presetItems.value[audioPresetKey.value].name;
      }

      // 既存で再登録する場合は再登録ダイアログを表示
      if (isRegisteredPreset.value && overwrite) {
        showsPresetRewriteDialog.value = true;
        return;
      }

      // それ以外はダイアログを表示
      showsPresetNameDialog.value = true;
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

    const checkRewritePreset = async () => {
      if (presetList.value.find((e) => e.label === presetNameInDialog.value)) {
        showsPresetRewriteDialog.value = true;
      } else {
        const audioPresetKey = await addPreset();
        changePreset(audioPresetKey);
      }
    };

    // 入力パラメータから、name以外のPresetを取得
    const presetPartsFromParameter = computed<Omit<Preset, "name">>(() => {
      if (
        speedScaleSlider.state.currentValue.value == null ||
        pitchScaleSlider.state.currentValue.value == null ||
        intonationScaleSlider.state.currentValue.value == null ||
        volumeScaleSlider.state.currentValue.value == null ||
        prePhonemeLengthSlider.state.currentValue.value == null ||
        postPhonemeLengthSlider.state.currentValue.value == null
      )
        throw new Error("slider value is null");

      return {
        speedScale: speedScaleSlider.state.currentValue.value,
        pitchScale: pitchScaleSlider.state.currentValue.value,
        intonationScale: intonationScaleSlider.state.currentValue.value,
        volumeScale: volumeScaleSlider.state.currentValue.value,
        prePhonemeLength: prePhonemeLengthSlider.state.currentValue.value,
        postPhonemeLength: postPhonemeLengthSlider.state.currentValue.value,
      };
    });

    const createPresetData = (name: string): Preset => {
      return { name, ...presetPartsFromParameter.value };
    };

    // プリセット新規追加
    const addPreset = () => {
      const name = presetNameInDialog.value;
      const newPreset = createPresetData(name);
      if (newPreset == undefined) throw Error("newPreset == undefined");

      closeAllDialog();

      return store.dispatch("ADD_PRESET", {
        presetData: newPreset,
      });
    };

    const updatePreset = async (fullApply: boolean) => {
      const key = presetList.value.find(
        (preset) => preset.label === presetNameInDialog.value
      )?.key;
      if (key === undefined) return;

      const title = presetNameInDialog.value;
      const newPreset = createPresetData(title);
      if (newPreset == undefined) return;

      await store.dispatch("UPDATE_PRESET", {
        presetData: newPreset,
        presetKey: key,
      });

      if (fullApply) {
        await store.dispatch("COMMAND_FULLY_APPLY_AUDIO_PRESET", {
          presetKey: key,
        });
      }

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
      applyPreset,
      enablePreset,
      isRegisteredPreset,
      isChangedPreset,
      presetList,
      selectablePresetList,
      presetOptionsList,
      filterPresetOptionsList,
      presetSelectModel,
      setPresetByScroll,
      checkRewritePreset,
      updatePreset,
      registerPreset,
      showsPresetNameDialog,
      presetName: presetNameInDialog,
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
