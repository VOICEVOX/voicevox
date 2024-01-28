import { FetchAudioResult } from "./type";
import { AudioKey } from "@/type/preload";

export class ContinuousPlayer extends EventTarget {
  private playQueue: ({ audioKey: AudioKey } & FetchAudioResult)[] = [];
  private generating?: { audioKey: AudioKey };
  private playing?: { audioKey: AudioKey } & FetchAudioResult;

  private finished = false;
  private resolve!: () => void;
  private promise: Promise<void>;

  constructor(private generateQueue: AudioKey[]) {
    super();

    this.addEventListener("generatestart", (e) => {
      this.generating = { audioKey: e.audioKey };
    });
    this.addEventListener("generateend", (e) => {
      delete this.generating;

      const { audioKey, result } = e;
      if (this.playing) {
        this.playQueue.push({ audioKey, ...result });
      } else {
        this.dispatchEvent(new WaitEndEvent(e.audioKey));
        if (this.finished) return;
        this.dispatchEvent(new PlayStartEvent(audioKey, result));
      }

      const next = this.generateQueue.shift();
      if (next) {
        this.dispatchEvent(new GenerateStartEvent(next));
      }
    });
    this.addEventListener("playstart", (e) => {
      this.playing = { audioKey: e.audioKey, ...e.result };
    });
    this.addEventListener("playend", (e) => {
      delete this.playing;
      if (e.forceFinish) {
        this.finish();
        return;
      }

      const next = this.playQueue.shift();
      if (next) {
        this.dispatchEvent(new PlayStartEvent(next.audioKey, next));
      } else if (this.generating) {
        this.dispatchEvent(new WaitStartEvent(this.generating.audioKey));
      } else {
        this.finish();
      }
    });

    this.promise = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  private finish() {
    this.finished = true;
    this.resolve();
  }

  async play() {
    const next = this.generateQueue.shift();
    if (!next) return;
    this.dispatchEvent(new WaitStartEvent(next));
    this.dispatchEvent(new GenerateStartEvent(next));

    await this.promise;
  }
}

export interface ContinuousPlayer extends EventTarget {
  addEventListener<K extends keyof ContinuousPlayerEvents>(
    type: K,
    listener: (this: ContinuousPlayer, ev: ContinuousPlayerEvents[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void;
}

interface ContinuousPlayerEvents {
  generatestart: GenerateStartEvent;
  generateend: GenerateEndEvent;
  playstart: PlayStartEvent;
  playend: PlayEndEvent;
  waitstart: WaitStartEvent;
  waitend: WaitEndEvent;
}

export class GenerateStartEvent extends Event {
  constructor(public audioKey: AudioKey) {
    super("generatestart");
  }
}

export class GenerateEndEvent extends Event {
  constructor(public audioKey: AudioKey, public result: FetchAudioResult) {
    super("generateend");
  }
}

export class PlayStartEvent extends Event {
  constructor(public audioKey: AudioKey, public result: FetchAudioResult) {
    super("playstart");
  }
}

export class PlayEndEvent extends Event {
  constructor(public audioKey: AudioKey, public forceFinish: boolean) {
    super("playend");
  }
}

export class WaitStartEvent extends Event {
  constructor(public audioKey: AudioKey) {
    super("waitstart");
  }
}

export class WaitEndEvent extends Event {
  constructor(public audioKey: AudioKey) {
    super("waitend");
  }
}
