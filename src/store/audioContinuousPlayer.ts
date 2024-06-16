import { AudioKey } from "@/type/preload";

interface DI {
  /**
   * 音声を生成する
   */
  generateAudio({ audioKey }: { audioKey: AudioKey }): Promise<Blob>;

  /**
   * 音声を再生する。
   * 再生が完了した場合trueを、途中で停止した場合falseを返す。
   */
  playAudioBlob({
    audioBlob,
    audioKey,
  }: {
    audioBlob: Blob;
    audioKey: AudioKey;
  }): Promise<boolean>;
}

/**
 * 音声を生成しながら連続再生する。
 * 生成の開始・完了、再生の開始・完了、生成待機の開始・完了のイベントを発行する。
 */
export class ContinuousPlayer extends EventTarget {
  private generating?: AudioKey;
  private playQueue: { audioKey: AudioKey; audioBlob: Blob }[] = [];
  private playing?: { audioKey: AudioKey; audioBlob: Blob };

  private finished = false;
  private resolve!: () => void;
  private promise: Promise<void>;

  constructor(
    private generationQueue: AudioKey[],
    { generateAudio, playAudioBlob }: DI,
  ) {
    super();

    this.addEventListener("generatestart", (e) => {
      this.generating = e.audioKey;
    });
    this.addEventListener("generatestart", async (e) => {
      const audioBlob = await generateAudio({ audioKey: e.audioKey });
      this.dispatchEvent(new GenerateEndEvent(e.audioKey, audioBlob));
    });
    this.addEventListener("generateend", (e) => {
      delete this.generating;

      const { audioKey, audioBlob } = e;
      if (this.playing) {
        this.playQueue.push({ audioKey, audioBlob });
      } else {
        this.dispatchEvent(new WaitEndEvent(e.audioKey));
        if (this.finished) return;
        this.dispatchEvent(new PlayStartEvent(audioKey, audioBlob));
      }

      const next = this.generationQueue.shift();
      if (next) {
        this.dispatchEvent(new GenerateStartEvent(next));
      }
    });
    this.addEventListener("playstart", (e) => {
      this.playing = { audioKey: e.audioKey, audioBlob: e.audioBlob };
    });
    this.addEventListener("playstart", async (e) => {
      const isEnded = await playAudioBlob({
        audioBlob: e.audioBlob,
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
        this.dispatchEvent(new PlayStartEvent(next.audioKey, next.audioBlob));
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

  /**
   * 音声の生成・再生を開始する。
   * すべての音声の再生が完了するか、途中で停止されるとresolveする。
   */
  async playUntilComplete() {
    const next = this.generationQueue.shift();
    if (!next) return;
    this.dispatchEvent(new WaitStartEvent(next));
    this.dispatchEvent(new GenerateStartEvent(next));

    await this.promise;
  }

  addEventListener<K extends keyof ContinuousPlayerEvents>(
    type: K,
    listener: (this: ContinuousPlayer, ev: ContinuousPlayerEvents[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;

  // FIXME: 上のシグネチャ定義と同じ形なので冗長かも？
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) {
    super.addEventListener(type, listener, options);
  }
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
  constructor(
    public audioKey: AudioKey,
    public audioBlob: Blob,
  ) {
    super("generateend");
  }
}

export class PlayStartEvent extends Event {
  constructor(
    public audioKey: AudioKey,
    public audioBlob: Blob,
  ) {
    super("playstart");
  }
}

export class PlayEndEvent extends Event {
  constructor(
    public audioKey: AudioKey,
    public forceFinish: boolean,
  ) {
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
