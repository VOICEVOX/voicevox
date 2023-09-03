class Timer {
  private timeoutId?: number;

  constructor(interval: number, callback: () => void) {
    const tick = () => {
      callback();
      this.timeoutId = window.setTimeout(tick, interval);
    };
    tick();
  }

  dispose() {
    if (this.timeoutId !== undefined) {
      window.clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
  }
}

export type AudioSequence = {
  readonly type: "audio";
  readonly audioPlayer: AudioPlayer;
  readonly audioEvents: AudioEvent[];
};

export type NoteSequence = {
  readonly type: "note";
  readonly instrument: Instrument;
  readonly noteEvents: NoteEvent[];
};

export type Sequence = AudioSequence | NoteSequence;

interface EventScheduler {
  start(contextTime: number, time: number): void;
  schedule(untilTime: number): void;
  stop(contextTime: number): void;
}

export interface BaseTransport {
  addSequence(sequence: Sequence): void;
  removeSequence(sequence: Sequence): void;
}

/**
 * 登録されているシーケンスのイベントをスケジュールし、再生を行います。
 */
export class Transport implements BaseTransport {
  private readonly audioContext: AudioContext;
  private readonly timer: Timer;
  private readonly lookAhead: number;

  private _state: "started" | "stopped" = "stopped";
  private _time = 0;
  private sequences = new Set<Sequence>();

  private startContextTime = 0;
  private startTime = 0;
  private schedulers = new Map<Sequence, EventScheduler>();

  get state() {
    return this._state;
  }

  get time() {
    if (this._state === "started") {
      const contextTime = this.audioContext.currentTime;
      this._time = this.calculateTime(contextTime);
    }
    return this._time;
  }

  set time(value: number) {
    if (this._state === "started") {
      this.stop();
      this._time = value;
      this.start();
    } else {
      this._time = value;
    }
  }

  /**
   * @param audioContext コンテキスト時間の取得に使用するAudioContext。
   * @param interval スケジューリングを行う間隔。
   * @param lookAhead スケジューリングで先読みする時間。スケジューリングが遅れた場合でも正しく再生されるように、スケジューリングを行う間隔より長く設定する必要があります。
   */
  constructor(audioContext: AudioContext, interval: number, lookAhead: number) {
    if (lookAhead <= interval) {
      throw new Error("Look-ahead time must be longer than the interval.");
    }

    this.audioContext = audioContext;
    this.lookAhead = lookAhead;
    this.timer = new Timer(interval * 1000, () => {
      if (this._state === "started") {
        const contextTime = this.audioContext.currentTime;
        this.schedule(contextTime);
      }
    });
  }

  private calculateTime(contextTime: number) {
    const elapsedTime = contextTime - this.startContextTime;
    return this.startTime + elapsedTime;
  }

  private createScheduler(sequence: Sequence) {
    let scheduler: EventScheduler | undefined;
    if (sequence.type === "audio") {
      scheduler = new AudioEventScheduler(
        sequence.audioPlayer,
        sequence.audioEvents
      );
    } else {
      scheduler = new NoteEventScheduler(
        sequence.instrument,
        sequence.noteEvents
      );
    }
    return scheduler;
  }

  private schedule(contextTime: number) {
    const time = this.calculateTime(contextTime);

    // シーケンスの削除を反映
    const removedSequences: Sequence[] = [];
    this.schedulers.forEach((scheduler, sequence) => {
      if (!this.sequences.has(sequence)) {
        scheduler.stop(contextTime);
        removedSequences.push(sequence);
      }
    });
    removedSequences.forEach((sequence) => {
      this.schedulers.delete(sequence);
    });

    // シーケンスの追加を反映
    this.sequences.forEach((sequence) => {
      if (!this.schedulers.has(sequence)) {
        const scheduler = this.createScheduler(sequence);
        scheduler.start(contextTime, time);
        this.schedulers.set(sequence, scheduler);
      }
    });

    this.schedulers.forEach((scheduler) => {
      scheduler.schedule(time + this.lookAhead);
    });
  }

  /**
   * シーケンスを追加します。再生中に追加した場合は、次のスケジューリングで反映されます。
   */
  addSequence(sequence: Sequence) {
    if (this.sequences.has(sequence)) {
      throw new Error("The sequence has already been added.");
    }
    this.sequences.add(sequence);
  }

  /**
   * シーケンスを削除します。再生中に削除した場合は、次のスケジューリングで反映されます。
   */
  removeSequence(sequence: Sequence) {
    if (!this.sequences.has(sequence)) {
      throw new Error("The sequence does not exist.");
    }
    this.sequences.delete(sequence);
  }

  start() {
    if (this._state === "started") return;
    const contextTime = this.audioContext.currentTime;

    this._state = "started";

    this.startContextTime = contextTime;
    this.startTime = this._time;

    this.schedule(contextTime);
  }

  stop() {
    if (this._state === "stopped") return;
    const contextTime = this.audioContext.currentTime;
    this._time = this.calculateTime(contextTime);

    this._state = "stopped";

    this.schedulers.forEach((value) => {
      value.stop(contextTime);
    });
    this.schedulers.clear();
  }

  dispose() {
    if (this.state === "started") {
      this.stop();
    }
    this.timer.dispose();
  }
}

/**
 * 登録されているシーケンスのイベントをスケジュールします。主に保存用途です。
 */
export class OfflineTransport implements BaseTransport {
  private schedulers = new Map<Sequence, EventScheduler>();

  private createScheduler(sequence: Sequence) {
    let scheduler: EventScheduler | undefined;
    if (sequence.type === "audio") {
      scheduler = new AudioEventScheduler(
        sequence.audioPlayer,
        sequence.audioEvents
      );
    } else {
      scheduler = new NoteEventScheduler(
        sequence.instrument,
        sequence.noteEvents
      );
    }
    return scheduler;
  }

  addSequence(sequence: Sequence) {
    if (this.schedulers.has(sequence)) {
      throw new Error("The sequence has already been added.");
    }
    const scheduler = this.createScheduler(sequence);
    this.schedulers.set(sequence, scheduler);
  }

  removeSequence(sequence: Sequence) {
    if (!this.schedulers.has(sequence)) {
      throw new Error("The sequence does not exist.");
    }
    this.schedulers.delete(sequence);
  }

  schedule(startTime: number, period: number) {
    this.schedulers.forEach((scheduler) => {
      scheduler.start(0, startTime);
      scheduler.schedule(period);
      scheduler.stop(period);
    });
  }
}

export type AudioEvent = {
  readonly time: number;
  readonly buffer: AudioBuffer;
};

/**
 * オーディオイベントをスケジュールします。
 * 使い捨てで、startメソッドは一度しか呼び出せません。
 */
class AudioEventScheduler implements EventScheduler {
  private readonly player: AudioPlayer;
  private readonly events: AudioEvent[];

  private isStarted = false;
  private startContextTime = 0;
  private startTime = 0;
  private index = 0;

  constructor(audioPlayer: AudioPlayer, audioEvents: AudioEvent[]) {
    this.player = audioPlayer;
    this.events = [...audioEvents];
    this.events.sort((a, b) => a.time - b.time);
  }

  start(contextTime: number, time: number) {
    if (this.isStarted) {
      throw new Error("Already started.");
    }

    this.startContextTime = contextTime;
    this.startTime = time;
    this.index = this.events.length;

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      if (event.time + event.buffer.duration > time) {
        this.index = i;
        break;
      }
    }

    this.isStarted = true;
  }

  schedule(untilTime: number) {
    if (!this.isStarted) {
      throw new Error("Not started.");
    }

    while (this.index < this.events.length) {
      const event = this.events[this.index];
      const offset = Math.max(this.startTime - event.time, 0);
      const contextTime =
        this.startContextTime + (event.time + offset - this.startTime);

      if (event.time < untilTime) {
        this.player.play(contextTime, offset, event.buffer);
        this.index++;
      } else break;
    }
  }

  stop(contextTime: number) {
    if (!this.isStarted) {
      throw new Error("Not started.");
    }

    this.player.allStop(contextTime);
  }
}

export interface Instrument {
  noteOn(contextTime: number, midi: number): void;
  noteOff(contextTime: number, midi: number): void;
  allSoundOff(contextTime?: number): void;
}

export type NoteEvent = {
  readonly noteOnTime: number;
  readonly noteOffTime: number;
  readonly midi: number;
};

/**
 * ノートイベントをスケジュールします。
 * 使い捨てで、startメソッドは一度しか呼び出せません。
 */
class NoteEventScheduler implements EventScheduler {
  private readonly instrument: Instrument;
  private readonly events: NoteEvent[];

  private isStarted = false;
  private startContextTime = 0;
  private startTime = 0;
  private index = 0;

  constructor(instrument: Instrument, noteEvents: NoteEvent[]) {
    this.instrument = instrument;
    this.events = [...noteEvents];
    this.events.sort((a, b) => a.noteOnTime - b.noteOnTime);
  }

  start(contextTime: number, time: number) {
    if (this.isStarted) {
      throw new Error("Already started.");
    }

    this.startContextTime = contextTime;
    this.startTime = time;
    this.index = this.events.length;

    for (let i = 0; i < this.events.length; i++) {
      if (this.events[i].noteOffTime > time) {
        this.index = i;
        break;
      }
    }

    this.isStarted = true;
  }

  schedule(untilTime: number) {
    if (!this.isStarted) {
      throw new Error("Not started.");
    }

    while (this.index < this.events.length) {
      const event = this.events[this.index];
      const noteOnTime = Math.max(event.noteOnTime, this.startTime);
      const noteOnContextTime =
        this.startContextTime + (noteOnTime - this.startTime);
      const noteOffContextTime =
        this.startContextTime + (event.noteOffTime - this.startTime);

      if (event.noteOnTime < untilTime) {
        this.instrument.noteOn(noteOnContextTime, event.midi);
        this.instrument.noteOff(noteOffContextTime, event.midi);
        this.index++;
      } else break;
    }
  }

  stop(contextTime: number) {
    if (!this.isStarted) {
      throw new Error("Not started.");
    }

    this.instrument.allSoundOff(contextTime);
  }
}

class AudioPlayerVoice {
  private readonly audioBufferSourceNode: AudioBufferSourceNode;
  private readonly buffer: AudioBuffer;

  private _isStopped = false;
  private stopContextTime?: number;

  get isStopped() {
    return this._isStopped;
  }

  constructor(audioContext: BaseAudioContext, buffer: AudioBuffer) {
    this.audioBufferSourceNode = audioContext.createBufferSource();
    this.audioBufferSourceNode.buffer = buffer;
    this.audioBufferSourceNode.onended = () => {
      this._isStopped = true;
    };
    this.buffer = buffer;
  }

  connect(destination: AudioNode) {
    this.audioBufferSourceNode.connect(destination);
  }

  play(contextTime: number, offset: number) {
    this.audioBufferSourceNode.start(contextTime, offset);
    this.stopContextTime = contextTime + this.buffer.duration;
  }

  stop(contextTime?: number) {
    if (this.stopContextTime === undefined) {
      throw new Error("Not started.");
    }
    if (contextTime === undefined || contextTime < this.stopContextTime) {
      this.audioBufferSourceNode.stop(contextTime);
      this.stopContextTime = contextTime ?? 0;
    }
  }
}

export type AudioPlayerOptions = {
  readonly volume: number;
};

export class AudioPlayer {
  private readonly audioContext: BaseAudioContext;
  private readonly gainNode: GainNode;

  private voices: AudioPlayerVoice[] = [];

  constructor(context: Context, options: AudioPlayerOptions = { volume: 1.0 }) {
    this.audioContext = context.audioContext;

    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = options.volume;
  }

  connect(destination: AudioNode) {
    this.gainNode.connect(destination);
  }

  disconnect() {
    this.gainNode.disconnect();
  }

  play(contextTime: number, offset: number, buffer: AudioBuffer) {
    const voice = new AudioPlayerVoice(this.audioContext, buffer);
    this.voices = this.voices.filter((value) => {
      return !value.isStopped;
    });
    this.voices.push(voice);
    voice.connect(this.gainNode);
    voice.play(contextTime, offset);
  }

  allStop(contextTime?: number) {
    if (contextTime === undefined) {
      this.voices.forEach((value) => {
        value.stop();
      });
      this.voices = [];
    } else {
      this.voices.forEach((value) => {
        value.stop(contextTime);
      });
    }
  }
}

export type Envelope = {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
};

type SynthVoiceOptions = {
  readonly midi: number;
  readonly oscillatorType: OscillatorType;
  readonly envelope: Envelope;
};

class SynthVoice {
  readonly midi: number;
  private readonly oscillatorNode: OscillatorNode;
  private readonly gainNode: GainNode;
  private readonly envelope: Envelope;

  private _isActive = false;
  private _isStopped = false;
  private stopContextTime?: number;

  get isActive() {
    return this._isActive;
  }

  get isStopped() {
    return this._isStopped;
  }

  constructor(audioContext: BaseAudioContext, options: SynthVoiceOptions) {
    this.midi = options.midi;
    this.envelope = options.envelope;

    this.oscillatorNode = audioContext.createOscillator();
    this.oscillatorNode.onended = () => {
      this._isStopped = true;
    };
    this.gainNode = audioContext.createGain();
    this.oscillatorNode.type = options.oscillatorType;
    this.oscillatorNode.connect(this.gainNode);
  }

  private midiToFrequency(midi: number) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  connect(destination: AudioNode) {
    this.gainNode.connect(destination);
  }

  noteOn(contextTime: number) {
    const t0 = contextTime;
    const atk = this.envelope.attack;
    const dcy = this.envelope.decay;
    const sus = this.envelope.sustain;

    this.gainNode.gain.value = 0;
    this.gainNode.gain.setValueAtTime(0, t0);
    this.gainNode.gain.linearRampToValueAtTime(1, t0 + atk);
    this.gainNode.gain.setTargetAtTime(sus, t0 + atk, dcy);

    const freq = this.midiToFrequency(this.midi);
    this.oscillatorNode.frequency.value = freq;

    this.oscillatorNode.start(contextTime);
    this._isActive = true;
  }

  noteOff(contextTime: number) {
    const t0 = contextTime;
    const rel = this.envelope.release;
    const stopContextTime = t0 + rel * 4;

    if (
      this.stopContextTime === undefined ||
      stopContextTime < this.stopContextTime
    ) {
      this.gainNode.gain.cancelAndHoldAtTime(t0);
      this.gainNode.gain.setTargetAtTime(0, t0, rel);

      this.oscillatorNode.stop(stopContextTime);
      this._isActive = false;

      this.stopContextTime = stopContextTime;
    }
  }

  soundOff(contextTime?: number) {
    if (
      contextTime === undefined ||
      this.stopContextTime === undefined ||
      contextTime < this.stopContextTime
    ) {
      this.oscillatorNode.stop(contextTime);
      this._isActive = false;

      this.stopContextTime = contextTime ?? 0;
    }
  }
}

export type SynthOptions = {
  readonly volume: number;
  readonly oscillatorType: OscillatorType;
  readonly envelope: Envelope;
};

/**
 * ポリフォニックなシンセサイザー。
 */
export class Synth implements Instrument {
  private readonly audioContext: BaseAudioContext;
  private readonly gainNode: GainNode;
  private readonly oscillatorType: OscillatorType;
  private readonly envelope: Envelope;

  private voices: SynthVoice[] = [];

  constructor(
    context: Context,
    options: SynthOptions = {
      volume: 0.1,
      oscillatorType: "square",
      envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.7,
        release: 0.02,
      },
    }
  ) {
    this.audioContext = context.audioContext;

    this.oscillatorType = options.oscillatorType;
    this.envelope = options.envelope;
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = options.volume;
  }

  connect(destination: AudioNode) {
    this.gainNode.connect(destination);
  }

  disconnect() {
    this.gainNode.disconnect();
  }

  noteOn(contextTime: number, midi: number) {
    const exists = this.voices.some((value) => {
      return value.isActive && value.midi === midi;
    });
    if (exists) return;

    const voice = new SynthVoice(this.audioContext, {
      midi,
      oscillatorType: this.oscillatorType,
      envelope: this.envelope,
    });
    this.voices = this.voices.filter((value) => {
      return !value.isStopped;
    });
    this.voices.push(voice);
    voice.connect(this.gainNode);
    voice.noteOn(contextTime);
  }

  noteOff(contextTime: number, midi: number) {
    const voice = this.voices.find((value) => {
      return value.isActive && value.midi === midi;
    });
    if (!voice) return;

    voice.noteOff(contextTime);
  }

  allSoundOff(contextTime?: number) {
    if (contextTime === undefined) {
      this.voices.forEach((value) => {
        value.soundOff();
      });
      this.voices = [];
    } else {
      this.voices.forEach((value) => {
        value.soundOff(contextTime);
      });
    }
  }
}

export type Context = {
  readonly audioContext: BaseAudioContext;
  readonly transport: BaseTransport;
};

export class AudioRenderer {
  private readonly onlineContext: {
    readonly audioContext: AudioContext;
    readonly transport: Transport;
  };

  get context(): Context {
    return {
      audioContext: this.onlineContext.audioContext,
      transport: this.onlineContext.transport,
    };
  }

  get audioContext() {
    return this.onlineContext.audioContext;
  }

  get transport() {
    return this.onlineContext.transport;
  }

  constructor() {
    const audioContext = new AudioContext();
    const transport = new Transport(audioContext, 0.2, 0.6);
    this.onlineContext = { audioContext, transport };
  }

  async createAudioBuffer(blob: Blob) {
    const audioContext = this.onlineContext.audioContext;
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }

  async renderToBuffer(
    sampleRate: number,
    startTime: number,
    duration: number,
    callback: (context: Context) => void
  ) {
    if (this.onlineContext.transport.state === "started") {
      this.onlineContext.transport.stop();
    }

    const length = sampleRate * duration;
    const audioContext = new OfflineAudioContext(2, length, sampleRate);
    const transport = new OfflineTransport();

    callback({ audioContext, transport });
    transport.schedule(startTime, duration);
    const audioBuffer = await audioContext.startRendering();
    return audioBuffer;
  }

  dispose() {
    this.onlineContext.transport.dispose();
    this.onlineContext.audioContext.close();
  }
}
