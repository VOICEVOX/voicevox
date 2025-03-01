<template>
  <QCard>
    <div class="title">Preview Sound Editor</div>
    <QSeparator />
    <QCardSection horizontal>
      <div class="synth-section">
        <div class="synth-section-label">Oscillator</div>
        <div class="synth-section-content">
          <div class="synth-param">
            <label class="synth-param-label">OddHarm</label>
            <Knob
              v-model="oscOddHarm"
              :size="50"
              :min="0"
              :max="1"
              :default="defaultOscOddHarm"
              class="synth-param-knob"
            />
          </div>
          <div class="synth-param">
            <label class="synth-param-label">EvenHarm</label>
            <Knob
              v-model="oscEvenHarm"
              :size="50"
              :min="0"
              :max="1"
              :default="defaultOscEvenHarm"
              class="synth-param-knob"
            />
          </div>
        </div>
      </div>
      <QSeparator vertical />
      <div class="synth-section">
        <div class="synth-section-label">Filter</div>
        <div class="synth-section-content">
          <div class="synth-param">
            <label class="synth-param-label">Cutoff</label>
            <Knob
              v-model="filterCutoff"
              :size="50"
              :min="20"
              :max="20000"
              :default="defaultParams.filterParams.cutoff"
              logScale
              class="synth-param-knob"
            />
          </div>
          <div class="synth-param">
            <label class="synth-param-label">Resonance</label>
            <Knob
              v-model="filterResonance"
              :size="50"
              :min="0"
              :max="10"
              :default="defaultParams.filterParams.resonance"
              class="synth-param-knob"
            />
          </div>
          <div class="synth-param">
            <label class="synth-param-label">KeyTrack</label>
            <Knob
              v-model="filterKeyTrack"
              :size="50"
              :min="0"
              :max="1"
              :default="defaultParams.filterParams.keyTrack"
              class="synth-param-knob"
            />
          </div>
        </div>
      </div>
      <QSeparator vertical />
      <div class="synth-section">
        <div class="synth-section-label">Amp</div>
        <div class="synth-section-content">
          <div class="synth-param">
            <label class="synth-param-label">Attack</label>
            <Knob
              v-model="ampAttack"
              :size="50"
              :min="0.001"
              :max="5"
              :default="defaultParams.ampParams.attack"
              logScale
              class="synth-param-knob"
            />
          </div>
          <div class="synth-param">
            <label class="synth-param-label">Decay</label>
            <Knob
              v-model="ampDecay"
              :size="50"
              :min="0.001"
              :max="5"
              :default="defaultParams.ampParams.decay"
              logScale
              class="synth-param-knob"
            />
          </div>
          <div class="synth-param">
            <label class="synth-param-label">Sustain</label>
            <Knob
              v-model="ampSustain"
              :size="50"
              :min="0"
              :max="1"
              :default="defaultParams.ampParams.sustain"
              class="synth-param-knob"
            />
          </div>
          <div class="synth-param">
            <label class="synth-param-label">Release</label>
            <Knob
              v-model="ampRelease"
              :size="50"
              :min="0.001"
              :max="5"
              :default="defaultParams.ampParams.release"
              logScale
              class="synth-param-knob"
            />
          </div>
        </div>
      </div>
      <QSeparator vertical />
      <div class="synth-section">
        <div class="synth-section-label">Low Cut</div>
        <div class="synth-section-content">
          <div class="synth-param">
            <div class="synth-param-label"></div>
            <Knob
              v-model="lowCutFrequency"
              :size="50"
              :min="20"
              :max="20000"
              :default="defaultParams.lowCutFrequency"
              logScale
              class="synth-param-knob"
            />
          </div>
        </div>
      </div>
      <QSeparator vertical />
      <div class="synth-section">
        <div class="synth-section-label">Volume</div>
        <div class="synth-section-content">
          <div class="synth-param">
            <div class="synth-param-label"></div>
            <Knob
              v-model="volume"
              :size="50"
              :min="0"
              :max="1"
              :default="defaultParams.volume"
              class="synth-param-knob"
            />
          </div>
        </div>
      </div>
    </QCardSection>
    <QSeparator />
    <div class="midi-input">
      <div style="margin-right: 16px">{{ webMidiApiLog }}</div>
      <div style="margin-right: 12px">MIDI Input:</div>
      <QSelect
        v-model="midiInputSelectValue"
        :options="midiInputSelectOptions"
        optionValue="id"
        optionLabel="name"
        dense
        class="midi-device-select"
      />
    </div>
  </QCard>
</template>

<script setup lang="ts">
import { QCard, QSelect, QSeparator } from "quasar";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useStore } from "@/store";
import Knob from "@/components/Sing/PreviewSoundEditorKnob.vue";
import { getHarmonicsAmount } from "@/sing/domain";
import { PreviewSynthOscParams } from "@/store/type";

const store = useStore();

const getOddHarmonicsAmount = (oscParams: PreviewSynthOscParams) => {
  return oscParams.type === "custom"
    ? oscParams.oddHarmonicsAmount
    : getHarmonicsAmount(oscParams.type).odd;
};

const getEvenHarmonicsAmount = (oscParams: PreviewSynthOscParams) => {
  return oscParams.type === "custom"
    ? oscParams.evenHarmonicsAmount
    : getHarmonicsAmount(oscParams.type).even;
};

const oscOddHarm = computed({
  get() {
    const oscParams = store.state.previewSynthParams.oscParams;
    return getOddHarmonicsAmount(oscParams);
  },
  set(newValue) {
    const oscParams = store.state.previewSynthParams.oscParams;
    const oddHarmonicsAmount = newValue;
    const evenHarmonicsAmount =
      oscParams.type === "custom"
        ? oscParams.evenHarmonicsAmount
        : getHarmonicsAmount(oscParams.type).even;
    void store.actions.SET_PREVIEW_SYNTH_OSC_PARAMS({
      oscParams: { type: "custom", oddHarmonicsAmount, evenHarmonicsAmount },
    });
  },
});

const oscEvenHarm = computed({
  get() {
    const oscParams = store.state.previewSynthParams.oscParams;
    return getEvenHarmonicsAmount(oscParams);
  },
  set(newValue) {
    const oscParams = store.state.previewSynthParams.oscParams;
    const oddHarmonicsAmount =
      oscParams.type === "custom"
        ? oscParams.oddHarmonicsAmount
        : getHarmonicsAmount(oscParams.type).odd;
    const evenHarmonicsAmount = newValue;
    void store.actions.SET_PREVIEW_SYNTH_OSC_PARAMS({
      oscParams: { type: "custom", oddHarmonicsAmount, evenHarmonicsAmount },
    });
  },
});

const filterCutoff = computed({
  get() {
    return store.state.previewSynthParams.filterParams.cutoff;
  },
  set(newValue) {
    const filterParams = store.state.previewSynthParams.filterParams;
    void store.actions.SET_PREVIEW_SYNTH_FILTER_PARAMS({
      filterParams: { ...filterParams, cutoff: newValue },
    });
  },
});

const filterResonance = computed({
  get() {
    return store.state.previewSynthParams.filterParams.resonance;
  },
  set(newValue) {
    const filterParams = store.state.previewSynthParams.filterParams;
    void store.actions.SET_PREVIEW_SYNTH_FILTER_PARAMS({
      filterParams: { ...filterParams, resonance: newValue },
    });
  },
});

const filterKeyTrack = computed({
  get() {
    return store.state.previewSynthParams.filterParams.keyTrack;
  },
  set(newValue) {
    const filterParams = store.state.previewSynthParams.filterParams;
    void store.actions.SET_PREVIEW_SYNTH_FILTER_PARAMS({
      filterParams: { ...filterParams, keyTrack: newValue },
    });
  },
});

const ampAttack = computed({
  get() {
    return store.state.previewSynthParams.ampParams.attack;
  },
  set(newValue) {
    const ampParams = store.state.previewSynthParams.ampParams;
    void store.actions.SET_PREVIEW_SYNTH_AMP_PARAMS({
      ampParams: { ...ampParams, attack: newValue },
    });
  },
});

const ampDecay = computed({
  get() {
    return store.state.previewSynthParams.ampParams.decay;
  },
  set(newValue) {
    const ampParams = store.state.previewSynthParams.ampParams;
    void store.actions.SET_PREVIEW_SYNTH_AMP_PARAMS({
      ampParams: { ...ampParams, decay: newValue },
    });
  },
});

const ampSustain = computed({
  get() {
    return store.state.previewSynthParams.ampParams.sustain;
  },
  set(newValue) {
    const ampParams = store.state.previewSynthParams.ampParams;
    void store.actions.SET_PREVIEW_SYNTH_AMP_PARAMS({
      ampParams: { ...ampParams, sustain: newValue },
    });
  },
});

const ampRelease = computed({
  get() {
    return store.state.previewSynthParams.ampParams.release;
  },
  set(newValue) {
    const ampParams = store.state.previewSynthParams.ampParams;
    void store.actions.SET_PREVIEW_SYNTH_AMP_PARAMS({
      ampParams: { ...ampParams, release: newValue },
    });
  },
});

const lowCutFrequency = computed({
  get() {
    return store.state.previewSynthParams.lowCutFrequency;
  },
  set(newValue) {
    void store.actions.SET_PREVIEW_SYNTH_LOW_CUT_FREQUENCY({
      lowCutFrequency: newValue,
    });
  },
});

const volume = computed({
  get() {
    return store.state.previewSynthParams.volume;
  },
  set(newValue) {
    void store.actions.SET_PREVIEW_SYNTH_VOLUME({ volume: newValue });
  },
});

const defaultParams = computed(() => {
  return store.getters.DEFAULT_PREVIEW_SYNTH_PARAMS;
});

const defaultOscOddHarm = computed(() => {
  return getOddHarmonicsAmount(defaultParams.value.oscParams);
});

const defaultOscEvenHarm = computed(() => {
  return getEvenHarmonicsAmount(defaultParams.value.oscParams);
});

const midiInputSelectValue = ref<MIDIInput | undefined>(undefined);
const midiInputSelectOptions = ref<MIDIInput[]>([]);
const webMidiApiLog = ref("");

let midiAccess: MIDIAccess | undefined = undefined;
let midiInput: MIDIInput | undefined = undefined;

const isMIDIConnectionEvent = (event: Event): event is MIDIConnectionEvent => {
  return "port" in event;
};

const onStateChange = (event: Event) => {
  if (!isMIDIConnectionEvent(event)) {
    throw new Error("Event is not a MIDIConnectionEvent.");
  }
  if (midiAccess == undefined) {
    throw new Error("midiAccess is undefined.");
  }
  const port = event.port;

  if (port != undefined && port.type === "input") {
    const midiInputs = [...midiAccess.inputs.values()];

    midiInputSelectOptions.value = midiInputs;
    if (
      port.state === "disconnected" &&
      midiInput != undefined &&
      midiInput.id === port.id
    ) {
      if (midiInputs.length === 0) {
        midiInput = undefined;
      } else {
        midiInput = midiInputs[0];
      }
      midiInputSelectValue.value = midiInput;
    }
  }
};

const onMidiMessage = (event: MIDIMessageEvent) => {
  if (event.data == undefined) {
    return;
  }
  const [status, data1, data2] = event.data;
  const command = status & 0xf0;
  const noteNumber = data1;
  const velocity = data2;

  if (command === 0x90 && velocity > 0) {
    void store.actions.PLAY_PREVIEW_SOUND({ noteNumber });
    webMidiApiLog.value = `Note ON: ${noteNumber}, Velocity: ${velocity}`;
  } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
    void store.actions.STOP_PREVIEW_SOUND({ noteNumber });
    webMidiApiLog.value = `Note OFF: ${noteNumber}`;
  }
};

watch(
  midiInputSelectValue,
  (newValue) => {
    if (midiInput === newValue) {
      return;
    }
    midiInput?.removeEventListener("midimessage", onMidiMessage);
    midiInput = newValue;
    midiInput?.addEventListener("midimessage", onMidiMessage);
  },
  { immediate: true },
);

onMounted(() => {
  navigator.requestMIDIAccess().then(
    (value) => {
      midiAccess = value;
      midiAccess.addEventListener("statechange", onStateChange);

      const midiInputs = [...midiAccess.inputs.values()];

      midiInput = midiInputs.length === 0 ? undefined : midiInputs[0];
      midiInput?.addEventListener("midimessage", onMidiMessage);

      midiInputSelectOptions.value = midiInputs;
      midiInputSelectValue.value = midiInput;

      webMidiApiLog.value = "MIDI access granted.";
    },
    () => {
      webMidiApiLog.value = "Failed to access MIDI devices.";
    },
  );
});

onUnmounted(() => {
  midiAccess?.removeEventListener("statechange", onStateChange);
  midiInput?.removeEventListener("midimessage", onMidiMessage);
});
</script>

<style scoped lang="scss">
@use "@/styles/v2/variables" as vars;
@use "@/styles/colors" as colors;

.title {
  font-size: 15px;
  padding: 4px 12px;
}

.synth-section {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
}

.synth-param {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 70px;
}

.synth-param-label {
  height: 22px;
  font-size: 13px;
}

.synth-param-slider {
  margin-top: 16px;
  margin-bottom: 16px;
}

.synth-param-knob {
  margin-top: 4px;
}

.synth-section-label {
  font-size: 18px;
  white-space: nowrap;
}

.synth-section-content {
  display: flex;
  height: 110px;
  padding-top: 4px;
}

.midi-input {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 6px 16px;
}

.midi-device-select {
  min-width: 150px;
}
</style>
