import { AudioStoreTypes, FetchAudioResult, StoreType } from "./type";
import { ActionContext } from "./vuex";
import { AudioKey } from "@/type/preload";

type Store = Pick<AudioStoreTypes, "FETCH_AUDIO" | "PLAY_AUDIO_BLOB">;

type DI = Pick<
  ActionContext<
    Store,
    Store,
    StoreType<Store, "getter">,
    StoreType<Store, "action">,
    StoreType<Store, "mutation">
  >,
  "dispatch"
>;

interface Generated extends FetchAudioResult {
  audioKey: AudioKey;
}

export class ContinuousPlayer extends EventTarget {
  private generating?: AudioKey;
  private playQueue: Generated[] = [];
  private playing?: Generated;

  private finished = false;
  private resolve!: () => void;
  private promise: Promise<void>;

  constructor(private generateQueue: AudioKey[], { dispatch }: DI) {
    super();

    this.addEventListener("generatestart", (e) => {
      this.generating = e.audioKey;
    });
    this.addEventListener("generatestart", async (e) => {
      const result = await dispatch("FETCH_AUDIO", { audioKey: e.audioKey });
      this.dispatchEvent(new GenerateEndEvent(e.audioKey, result));
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
    this.addEventListener("playstart", async (e) => {
      const isEnded = await dispatch("PLAY_AUDIO_BLOB", {
        audioBlob: e.result.blob,
        audioKey: e.audioKey,
      });
      this.dispatchEvent(new PlayEndEvent(e.audioKey, !isEnded));
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
        this.dispatchEvent(new WaitStartEvent(this.generating));
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
