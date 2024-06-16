import {
  noteNumberToFrequency,
  decibelToLinear,
  linearToDecibel,
} from "@/sing/domain";
import { Timer } from "@/sing/utility";

const getEarliestSchedulableContextTime = (audioContext: BaseAudioContext) => {
  const renderQuantumSize = 128;
  const sampleRate = audioContext.sampleRate;
  const currentTime = audioContext.currentTime;
  return currentTime + (renderQuantumSize + 10) / sampleRate;
};

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

/**
 * イベントのスケジューリングを行うスケジューラーを表します。
 * スケジューリングの開始位置と停止位置をまたぐイベントも適切にスケジュールされます。
 */
interface EventScheduler {
  /**
   * スケジューリングを開始します。
   * @param contextTime スケジューリングを開始する時刻（コンテキスト時刻）
   * @param time スケジューリングの開始位置
   */
  start(contextTime: number, time: number): void;

  /**
   * 指定された位置までスケジューリングを行います。
   * @param untilTime どこまでスケジューリングを行うかを表す位置
   */
  schedule(untilTime: number): void;

  /**
   * スケジューリングを停止します。
   * @param contextTime スケジューリングを停止する時刻（コンテキスト時刻）
   */
  stop(contextTime: number): void;
}

/**
 * 複数のシーケンスのスケジューリングを行います。
 * 再生、停止、再生位置の変更などの機能を提供します。
 */
export class Transport {
  private readonly audioContext: AudioContext;
  private readonly timer: Timer;
  private readonly scheduleAheadTime: number;

  private _state: "started" | "stopped" = "stopped";
  private _time = 0;
  private sequences = new Set<Sequence>();

  private startContextTime = 0;
  private startTime = 0;
  private schedulers = new Map<Sequence, EventScheduler>();

  get state() {
    return this._state;
  }

  /**
   * 再生位置（秒）
   */
  get time() {
    if (this._state === "started") {
      // 再生中の場合は、現在時刻から再生位置を計算する
      const contextTime = this.audioContext.currentTime;
      const elapsedTime = contextTime - this.startContextTime;
      this._time = this.startTime + elapsedTime;
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
   * @param audioContext 音声コンテキスト
   * @param lookahead スケジューリングの間隔（秒）
   * @param scheduleAheadTime 先読みする時間（秒）（スケジューリングの間隔より長く設定する必要があります）
   */
  constructor(
    audioContext: AudioContext,
    lookahead = 0.2,
    scheduleAheadTime = 0.6,
  ) {
    if (scheduleAheadTime <= lookahead) {
      throw new Error(
        "The scheduleAheadTime must be longer than the lookahead.",
      );
    }

    this.audioContext = audioContext;
    this.scheduleAheadTime = scheduleAheadTime;
    this.timer = new Timer(lookahead * 1000);
    this.timer.start(() => {
      if (this._state === "started") {
        this.schedule(this.audioContext.currentTime);
      }
    });
  }

  /**
   * スケジューラーを作成します。
   * @param sequence スケジューラーでスケジューリングを行うシーケンス
   * @returns 作成したスケジューラー
   */
  private createScheduler(sequence: Sequence): EventScheduler {
    if (sequence.type === "audio") {
      const player = sequence.audioPlayer;
      const events = sequence.audioEvents;
      return new AudioEventScheduler(player, events);
    } else {
      const instrument = sequence.instrument;
      const events = sequence.noteEvents;
      return new NoteEventScheduler(instrument, events);
    }
  }

  /**
   * スケジューリングを行います。
   * @param contextTime スケジューリングを行う時刻（コンテキスト時刻）
   */
  private schedule(contextTime: number) {
    // 再生位置を計算
    const elapsedTime = contextTime - this.startContextTime;
    const time = this.startTime + elapsedTime;

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
      scheduler.schedule(time + this.scheduleAheadTime);
    });
  }

  /**
   * シーケンスを追加します。再生中に追加した場合は、次のスケジューリングで反映されます。
   * @param sequence 追加するシーケンス
   */
  addSequence(sequence: Sequence) {
    if (this.sequences.has(sequence)) {
      throw new Error("The sequence has already been added.");
    }
    this.sequences.add(sequence);
  }

  /**
   * シーケンスを削除します。再生中に削除した場合は、次のスケジューリングで反映されます。
   * @param sequence 削除するシーケンス
   */
  removeSequence(sequence: Sequence) {
    if (!this.sequences.has(sequence)) {
      throw new Error("The sequence does not exist.");
    }
    this.sequences.delete(sequence);
  }

  /**
   * 再生を開始します。すでに再生中の場合は何も行いません。
   */
  start() {
    if (this._state === "started") return;
    const contextTime = this.audioContext.currentTime;

    this._state = "started";

    this.startContextTime = contextTime;
    this.startTime = this._time;

    this.schedule(contextTime);
  }

  /**
   * 再生を停止します。すでに停止している場合は何も行いません。
   */
  stop() {
    if (this._state === "stopped") return;
    const contextTime = this.audioContext.currentTime;

    // 停止する前に再生位置を更新する
    const elapsedTime = contextTime - this.startContextTime;
    this._time = this.startTime + elapsedTime;

    this._state = "stopped";

    this.schedulers.forEach((value) => {
      value.stop(contextTime);
    });
    this.schedulers.clear();
  }

  /**
   * 破棄します。
   */
  dispose() {
    if (this.state === "started") {
      this.stop();
    }
    this.timer.stop();
  }
}

/**
 * 複数のシーケンスのスケジューリングを行います。
 * オフラインレンダリングで使用します。
 */
export class OfflineTransport {
  private schedulers = new Map<Sequence, EventScheduler>();

  /**
   * スケジューラーを作成します。
   * @param sequence スケジューラーでスケジューリングを行うシーケンス
   * @returns 作成したスケジューラー
   */
  private createScheduler(sequence: Sequence): EventScheduler {
    if (sequence.type === "audio") {
      const player = sequence.audioPlayer;
      const events = sequence.audioEvents;
      return new AudioEventScheduler(player, events);
    } else {
      const instrument = sequence.instrument;
      const events = sequence.noteEvents;
      return new NoteEventScheduler(instrument, events);
    }
  }

  /**
   * シーケンスを追加します。
   * @param sequence 追加するシーケンス
   */
  addSequence(sequence: Sequence) {
    if (this.schedulers.has(sequence)) {
      throw new Error("The sequence has already been added.");
    }
    const scheduler = this.createScheduler(sequence);
    this.schedulers.set(sequence, scheduler);
  }

  /**
   * シーケンスを削除します。
   * @param sequence 削除するシーケンス
   */
  removeSequence(sequence: Sequence) {
    if (!this.schedulers.has(sequence)) {
      throw new Error("The sequence does not exist.");
    }
    this.schedulers.delete(sequence);
  }

  /**
   * スケジューリングを行います。
   * @param startTime スケジューリングの開始位置（秒）
   * @param duration スケジューリングの長さ（秒）
   */
  schedule(startTime: number, duration: number) {
    this.schedulers.forEach((scheduler) => {
      scheduler.start(0, startTime);
      scheduler.schedule(duration);
      scheduler.stop(duration);
    });
  }
}

export type AudioEvent = {
  readonly time: number;
  readonly buffer: AudioBuffer;
};

/**
 * オーディオイベントのスケジューリングを行うスケジューラーです。
 * スケジューリングの開始位置と停止位置をまたぐイベントも適切にスケジュールされます。
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

  /**
   * スケジューリングを開始します。
   * このメソッドは一度しか呼び出せません。
   * @param contextTime スケジューリングを開始する時刻（コンテキスト時刻）
   * @param time スケジューリングの開始位置
   */
  start(contextTime: number, time: number) {
    if (this.isStarted) {
      throw new Error("Already started.");
    }

    this.startContextTime = contextTime;
    this.startTime = time;
    this.index = this.events.length;

    // 最初にスケジュールするイベントのインデックスを調べて設定する
    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      const eventEndTime = event.time + event.buffer.duration;
      if (eventEndTime > time) {
        this.index = i;
        break;
      }
    }

    this.isStarted = true;
  }

  /**
   * 指定された位置までスケジューリングを行います。
   * @param untilTime どこまでスケジューリングを行うかを表す位置
   */
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

  /**
   * スケジューリングを停止します。
   * @param contextTime スケジューリングを停止する時刻（コンテキスト時刻）
   */
  stop(contextTime: number) {
    if (!this.isStarted) {
      throw new Error("Not started.");
    }

    this.player.allStop(contextTime);
  }
}

/**
 * 楽器を表します。
 */
export interface Instrument {
  readonly output: AudioNode;

  /**
   * ノートオンをスケジュールします。
   * すでに指定されたノート番号でノートオンがスケジュールされている場合は何も行いません。
   * @param contextTime ノートオンを行う時刻（コンテキスト時刻）
   * @param noteNumber MIDIノート番号
   */
  noteOn(contextTime: number, noteNumber: number): void;

  /**
   * ノートオフをスケジュールします。
   * すでに指定されたノート番号でノートオフがスケジュールされている場合は何も行いません。
   * @param contextTime ノートオフを行う時刻（コンテキスト時刻）
   * @param noteNumber MIDIノート番号
   */
  noteOff(contextTime: number, noteNumber: number): void;

  /**
   * 発音中のすべての音に対して、ノートオフのスケジュールを行います。
   * すでにノートオフがスケジュールされている音の場合は、
   * 指定された時刻が現在スケジュールされている時刻よりも早い場合にのみ再スケジュールを行います。
   * @param contextTime ノートオフを行う時刻（コンテキスト時刻）
   */
  allNotesOff(contextTime: number): void;
}

export type NoteEvent = {
  readonly noteOnTime: number;
  readonly noteOffTime: number;
  readonly noteNumber: number;
};

/**
 * ノートイベントのスケジューリングを行うスケジューラーです。
 * スケジューリングの開始位置と停止位置をまたぐイベントも適切にスケジュールされます。
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

  /**
   * スケジューリングを開始します。
   * このメソッドは一度しか呼び出せません。
   * @param contextTime スケジューリングを開始する時刻（コンテキスト時刻）
   * @param time スケジューリングの開始位置
   */
  start(contextTime: number, time: number) {
    if (this.isStarted) {
      throw new Error("Already started.");
    }

    this.startContextTime = contextTime;
    this.startTime = time;
    this.index = this.events.length;

    // 最初にスケジュールするイベントのインデックスを調べて設定する
    for (let i = 0; i < this.events.length; i++) {
      if (this.events[i].noteOffTime > time) {
        this.index = i;
        break;
      }
    }

    this.isStarted = true;
  }

  /**
   * 指定された位置までスケジューリングを行います。
   * @param untilTime どこまでスケジューリングを行うかを表す位置
   */
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
        this.instrument.noteOn(noteOnContextTime, event.noteNumber);
        this.instrument.noteOff(noteOffContextTime, event.noteNumber);
        this.index++;
      } else break;
    }
  }

  /**
   * スケジューリングを停止します。
   * @param contextTime スケジューリングを停止する時刻（コンテキスト時刻）
   */
  stop(contextTime: number) {
    if (!this.isStarted) {
      throw new Error("Not started.");
    }

    this.instrument.allNotesOff(contextTime);
  }
}

/**
 * オーディオプレイヤーのボイスです。音声の再生を行います。
 */
class AudioPlayerVoice {
  private readonly audioBufferSourceNode: AudioBufferSourceNode;
  private readonly buffer: AudioBuffer;

  private _isStopped = false;
  private stopContextTime?: number;

  get output(): AudioNode {
    return this.audioBufferSourceNode;
  }

  get isStopped() {
    return this._isStopped;
  }

  constructor(audioContext: BaseAudioContext, buffer: AudioBuffer) {
    this.audioBufferSourceNode = new AudioBufferSourceNode(audioContext);
    this.audioBufferSourceNode.buffer = buffer;
    this.audioBufferSourceNode.onended = () => {
      this._isStopped = true;
    };
    this.buffer = buffer;
  }

  /**
   * 音声の再生をスケジュールします。
   * このメソッドは一度しか呼び出せません。
   * @param contextTime 再生を行う時刻（コンテキスト時刻）
   * @param offset オフセット（秒）
   */
  play(contextTime: number, offset: number) {
    if (this.stopContextTime != undefined) {
      throw new Error("Already started.");
    }
    this.audioBufferSourceNode.start(contextTime, offset);
    this.stopContextTime = contextTime + this.buffer.duration;
  }

  /**
   * 音声の停止をスケジュールします。
   * すでに停止がスケジュールされている場合は、
   * 指定された時刻が現在スケジュールされている時刻よりも早い場合にのみ再スケジュールを行います。
   * @param contextTime 停止する時刻（コンテキスト時刻）
   */
  stop(contextTime: number) {
    if (this.stopContextTime == undefined) {
      throw new Error("Not started.");
    }
    if (contextTime < this.stopContextTime) {
      this.audioBufferSourceNode.stop(contextTime);
      this.stopContextTime = contextTime;
    }
  }
}

export type AudioPlayerOptions = {
  readonly volume?: number;
};

/**
 * 同時に複数の音声を再生することが可能なプレイヤーです。
 */
export class AudioPlayer {
  private readonly audioContext: BaseAudioContext;
  private readonly gainNode: GainNode;

  private voices: AudioPlayerVoice[] = [];

  get output(): AudioNode {
    return this.gainNode;
  }

  constructor(audioContext: BaseAudioContext, options?: AudioPlayerOptions) {
    this.audioContext = audioContext;

    this.gainNode = new GainNode(audioContext);
    this.gainNode.gain.value = options?.volume ?? 1.0;
  }

  /**
   * 音声の再生をスケジュールします。
   * @param contextTime 再生を行う時刻（コンテキスト時刻）
   * @param offset オフセット（秒）
   * @param buffer 再生する音声バッファ
   */
  play(contextTime: number, offset: number, buffer: AudioBuffer) {
    const voice = new AudioPlayerVoice(this.audioContext, buffer);
    this.voices = this.voices.filter((value) => {
      return !value.isStopped;
    });
    this.voices.push(voice);
    voice.output.connect(this.gainNode);
    voice.play(contextTime, offset);
  }

  /**
   * 再生中のすべての音声の停止をスケジュールします。
   * すでに停止がスケジュールされている音声の場合は、
   * 指定された時刻が現在スケジュールされている時刻よりも早い場合にのみ再スケジュールを行います。
   * @param contextTime 停止する時刻（コンテキスト時刻）
   */
  allStop(contextTime: number) {
    this.voices.forEach((value) => {
      value.stop(contextTime);
    });
  }
}

export type SynthOscParams = {
  readonly type: OscillatorType;
};

export type SynthFilterParams = {
  readonly cutoff: number;
  readonly resonance: number;
  readonly keyTrack: number;
};

export type SynthAmpParams = {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
};

type SynthVoiceParams = {
  readonly noteNumber: number;
  readonly osc: SynthOscParams;
  readonly filter: SynthFilterParams;
  readonly amp: SynthAmpParams;
};

/**
 * シンセサイザーのボイスです。音を合成します。
 */
class SynthVoice {
  readonly noteNumber: number;
  private readonly audioContext: BaseAudioContext;
  private readonly ampParams: SynthAmpParams;
  private readonly oscNode: OscillatorNode;
  private readonly gainNode: GainNode;
  private readonly filterNode: BiquadFilterNode;

  private _isActive = false;
  private _isStopped = false;
  private stopContextTime?: number;

  get output(): AudioNode {
    return this.gainNode;
  }

  get isActive() {
    return this._isActive;
  }

  get isStopped() {
    return this._isStopped;
  }

  constructor(audioContext: BaseAudioContext, params: SynthVoiceParams) {
    this.noteNumber = params.noteNumber;
    this.audioContext = audioContext;
    this.ampParams = params.amp;

    this.oscNode = new OscillatorNode(audioContext);
    this.oscNode.type = params.osc.type;
    this.oscNode.onended = () => {
      this._isStopped = true;
    };
    this.filterNode = new BiquadFilterNode(audioContext);
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.value = this.calcFilterFreq(
      params.filter.cutoff,
      params.filter.keyTrack,
      params.noteNumber,
    );
    this.filterNode.Q.value = this.calcFilterQ(params.filter.resonance);
    this.gainNode = new GainNode(audioContext, { gain: 0 });
    this.oscNode.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
  }

  private calcFilterFreq(cutoff: number, keyTrack: number, noteNumber: number) {
    return cutoff * Math.pow(2, ((noteNumber - 60) * keyTrack) / 12);
  }

  private calcFilterQ(resonance: number) {
    return linearToDecibel(Math.SQRT1_2) + resonance;
  }

  /**
   * ノートオンをスケジュールします。
   * @param contextTime ノートオンを行う時刻（コンテキスト時刻）
   */
  noteOn(contextTime: number) {
    const atk = this.ampParams.attack;
    const dcy = this.ampParams.decay;
    const sus = this.ampParams.sustain;
    const freq = noteNumberToFrequency(this.noteNumber);
    const t0 = Math.max(
      getEarliestSchedulableContextTime(this.audioContext),
      contextTime,
    );

    // アタック、ディケイ、サスティーンのスケジュールを行う
    this.gainNode.gain.setValueAtTime(0, t0);
    this.gainNode.gain.linearRampToValueAtTime(1, t0 + atk);
    this.gainNode.gain.setTargetAtTime(sus, t0 + atk, dcy);

    this.oscNode.frequency.value = freq;
    this.oscNode.start(t0);

    this._isActive = true;
  }

  /**
   * ノートオフをスケジュールします。
   * すでにノートオフがスケジュールされている場合は、
   * 指定された時刻が現在スケジュールされている時刻よりも早い場合にのみ再スケジュールを行います。
   * @param contextTime ノートオフを行う時刻（コンテキスト時刻）
   */
  noteOff(contextTime: number) {
    const rel = this.ampParams.release;
    const t0 = Math.max(
      getEarliestSchedulableContextTime(this.audioContext),
      contextTime,
    );
    const stopContextTime = t0 + rel * 4;

    if (
      this.stopContextTime == undefined ||
      stopContextTime < this.stopContextTime
    ) {
      // リリースのスケジュールを行う
      this.gainNode.gain.cancelAndHoldAtTime?.(t0); // Fiefoxで未対応
      this.gainNode.gain.setTargetAtTime(0, t0, rel);

      this.oscNode.stop(stopContextTime);

      this._isActive = false;
      this.stopContextTime = stopContextTime;
    }
  }
}

export type PolySynthOptions = {
  readonly volume?: number;
  readonly osc?: SynthOscParams;
  readonly filter?: SynthFilterParams;
  readonly amp?: SynthAmpParams;
};

/**
 * ポリフォニックシンセサイザーです。
 */
export class PolySynth implements Instrument {
  private readonly audioContext: BaseAudioContext;
  private readonly gainNode: GainNode;
  private readonly oscParams: SynthOscParams;
  private readonly filterParams: SynthFilterParams;
  private readonly ampParams: SynthAmpParams;

  private voices: SynthVoice[] = [];

  get output(): AudioNode {
    return this.gainNode;
  }

  constructor(audioContext: BaseAudioContext, options?: PolySynthOptions) {
    this.audioContext = audioContext;
    this.oscParams = options?.osc ?? {
      type: "square",
    };
    this.filterParams = options?.filter ?? {
      cutoff: 2500,
      resonance: 0,
      keyTrack: 0.25,
    };
    this.ampParams = options?.amp ?? {
      attack: 0.001,
      decay: 0.18,
      sustain: 0.5,
      release: 0.02,
    };

    this.gainNode = new GainNode(this.audioContext);
    this.gainNode.gain.value = options?.volume ?? 0.1;
  }

  /**
   * ノートオンをスケジュールします。
   * ノートの長さが指定された場合は、ノートオフもスケジュールします。
   * すでに指定されたノート番号でノートオンがスケジュールされている場合は何も行いません。
   * @param contextTime ノートオンを行う時刻（コンテキスト時刻）
   * @param noteNumber MIDIノート番号
   * @param duration ノートの長さ（秒）
   */
  noteOn(
    contextTime: number | "immediately",
    noteNumber: number,
    duration?: number,
  ) {
    let voice = this.voices.find((value) => {
      return value.isActive && value.noteNumber === noteNumber;
    });
    if (contextTime === "immediately") {
      contextTime = getEarliestSchedulableContextTime(this.audioContext);
    }
    if (!voice) {
      voice = new SynthVoice(this.audioContext, {
        noteNumber,
        osc: this.oscParams,
        filter: this.filterParams,
        amp: this.ampParams,
      });
      voice.output.connect(this.gainNode);
      voice.noteOn(contextTime);

      this.voices = this.voices.filter((value) => {
        return !value.isStopped;
      });
      this.voices.push(voice);
    }
    if (duration != undefined) {
      voice.noteOff(contextTime + duration);
    }
  }

  /**
   * ノートオフをスケジュールします。
   * すでに指定されたノート番号でノートオフがスケジュールされている場合は何も行いません。
   * @param contextTime ノートオフを行う時刻（コンテキスト時刻）
   * @param noteNumber MIDIノート番号
   */
  noteOff(contextTime: number | "immediately", noteNumber: number) {
    const voice = this.voices.find((value) => {
      return value.isActive && value.noteNumber === noteNumber;
    });
    if (contextTime === "immediately") {
      contextTime = getEarliestSchedulableContextTime(this.audioContext);
    }
    if (voice) {
      voice.noteOff(contextTime);
    }
  }

  /**
   * 発音中のすべての音に対して、ノートオフのスケジュールを行います。
   * すでにノートオフがスケジュールされている音の場合は、
   * 指定された時刻が現在スケジュールされている時刻よりも早い場合にのみ再スケジュールを行います。
   * @param contextTime ノートオフを行う時刻（コンテキスト時刻）
   */
  allNotesOff(contextTime: number) {
    this.voices.forEach((value) => {
      value.noteOff(contextTime);
    });
  }
}

export type ChannelStripOptions = {
  readonly volume?: number;
};

/**
 * ミキサーの1チャンネル分の機能を提供します。
 */
export class ChannelStrip {
  private readonly gainNode: GainNode;

  get input(): AudioNode {
    return this.gainNode;
  }

  get output(): AudioNode {
    return this.gainNode;
  }

  get volume() {
    return this.gainNode.gain.value;
  }
  set volume(value: number) {
    this.gainNode.gain.value = value;
  }

  constructor(audioContext: BaseAudioContext, options?: ChannelStripOptions) {
    this.gainNode = new GainNode(audioContext);
    this.gainNode.gain.value = options?.volume ?? 0.1;
  }
}

export type LimiterOptions = {
  readonly inputGain?: number;
  readonly outputGain?: number;
  readonly release?: number;
};

/**
 * リミッターです。大きい音を抑えます。
 */
export class Limiter {
  private readonly inputGainNode: GainNode;
  private readonly compNode: DynamicsCompressorNode;
  private readonly correctionGainNode: GainNode;
  private readonly outputGainNode: GainNode;

  get input(): AudioNode {
    return this.inputGainNode;
  }

  get output(): AudioNode {
    return this.outputGainNode;
  }

  /**
   * 入力ゲイン（dB）
   */
  get inputGain() {
    return this.getGainInDecibels(this.inputGainNode);
  }
  set inputGain(value: number) {
    this.setGainInDecibels(value, this.inputGainNode);
  }

  /**
   * 出力ゲイン（dB）
   */
  get outputGain() {
    return this.getGainInDecibels(this.outputGainNode);
  }
  set outputGain(value: number) {
    this.setGainInDecibels(value, this.outputGainNode);
  }

  /**
   * リリース（秒）
   */
  get release() {
    return this.compNode.release.value;
  }
  set release(value: number) {
    this.compNode.release.value = value;
  }

  get reduction() {
    return this.compNode.reduction;
  }

  constructor(audioContext: BaseAudioContext, options?: LimiterOptions) {
    this.inputGainNode = new GainNode(audioContext);
    this.compNode = new DynamicsCompressorNode(audioContext);
    this.correctionGainNode = new GainNode(audioContext);
    this.outputGainNode = new GainNode(audioContext);

    // TODO: 伴奏を再生する機能を実装したら、パラメーターを再調整する
    this.compNode.threshold.value = -5; // 0dBを超えそうになったら（-5dBを超えたら）圧縮する
    this.compNode.ratio.value = 20; // クリッピングが起こらないように、高いレシオ（1/20）で圧縮する
    this.compNode.knee.value = 8; // 自然にかかってほしいという気持ちで8に設定（リミッターなので0でも良いかも）
    this.compNode.attack.value = 0; // クリッピングが起こらないように、すぐに圧縮を開始する
    this.compNode.release.value = options?.release ?? 0.25; // 歪まないように少し遅めに設定

    // メイクアップゲインで上がった分を下げる（圧縮していないときは元の音量で出力）
    this.correctionGainNode.gain.value = 0.85;

    this.setGainInDecibels(options?.inputGain ?? 0, this.inputGainNode);
    this.setGainInDecibels(options?.outputGain ?? 0, this.outputGainNode);

    this.inputGainNode.connect(this.compNode);
    this.compNode.connect(this.correctionGainNode);
    this.correctionGainNode.connect(this.outputGainNode);
  }

  private getGainInDecibels(gainNode: GainNode) {
    return linearToDecibel(gainNode.gain.value);
  }

  private setGainInDecibels(value: number, gainNode: GainNode) {
    if (!Number.isFinite(value)) {
      throw new Error("Not a finite number.");
    }
    gainNode.gain.value = decibelToLinear(value);
  }
}

/**
 * 音声が0dB（-1～1の範囲）を超えないようにクリップします。
 */
export class Clipper {
  private readonly waveShaperNode: WaveShaperNode;

  get input(): AudioNode {
    return this.waveShaperNode;
  }

  get output(): AudioNode {
    return this.waveShaperNode;
  }

  constructor(audioContext: BaseAudioContext) {
    this.waveShaperNode = new WaveShaperNode(audioContext);
    this.waveShaperNode.curve = new Float32Array([-1, 0, 1]);
  }
}
