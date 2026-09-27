import type { AudioKey } from "@/type/preload";
import type { WavStream } from "@/domain/wavStream";
import { createLogger } from "@/helpers/log";
import { type Result, success, failure } from "@/type/result";

const log = createLogger("store/audioContinuousPlayer");

type GenerateAudioResult = {
  stream: WavStream;
  startOffset: number;
};
interface DI {
  generateAudio: (params: {
    audioKey: AudioKey;
  }) => Promise<GenerateAudioResult>;
  playAudioStream: (params: {
    audioKey: AudioKey;
    audio: GenerateAudioResult;
  }) => Promise<boolean>;
}

/** 現在の音声を再生しながら、次の1件を取得する。 */
export class ContinuousPlayer extends EventTarget {
  constructor(
    private readonly audioKeys: AudioKey[],
    private readonly di: DI,
  ) {
    super();
  }

  async playUntilComplete() {
    const { generateAudio, playAudioStream } = this.di;
    const prepareAudio = (
      audioKey: AudioKey,
    ): Promise<Result<GenerateAudioResult>> => {
      this.dispatchEvent(new GenerateStartEvent(audioKey));
      // エラー吐くタイミングを再生まで遅延させる（どこでエラーが起きたかをユーザーにわかりやすくするため）
      return generateAudio({ audioKey }).then(
        (result) => {
          this.dispatchEvent(new GenerateEndEvent(audioKey, result.stream));
          return success(result);
        },
        (error: unknown) => failure(error as Error),
      );
    };
    let pending: ReturnType<typeof prepareAudio> | undefined;
    let active: WavStream | undefined;
    try {
      for (const [index, audioKey] of this.audioKeys.entries()) {
        pending ??= prepareAudio(audioKey);
        this.dispatchEvent(new WaitStartEvent(audioKey));
        const result = await pending;
        pending = undefined;
        if (!result.ok) {
          throw result.error;
        }
        active = result.value.stream;
        this.dispatchEvent(new WaitEndEvent(audioKey));
        const nextAudioKey = this.audioKeys[index + 1];
        if (nextAudioKey != undefined) pending = prepareAudio(nextAudioKey);
        this.dispatchEvent(new PlayStartEvent(audioKey, active));
        const completed = await playAudioStream({
          audioKey,
          audio: result.value,
        });
        active = undefined;
        this.dispatchEvent(new PlayEndEvent(audioKey, !completed));
        if (!completed) return;
      }
    } finally {
      void active?.cancel();
      if (pending != undefined) {
        void pending.then((result) => {
          if (result.ok) {
            return result.value.stream.cancel();
          }
        });
      }
    }
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
    public stream: WavStream,
  ) {
    super("generateend");
  }
}

export class PlayStartEvent extends Event {
  constructor(
    public audioKey: AudioKey,
    public stream: WavStream,
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
