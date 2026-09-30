import { createLogger } from "@/helpers/log";
import { consumeStream } from "@/helpers/consumeStream";
import type { AudioKey } from "@/type/preload";
import { type Result, success, failure } from "@/type/result";
import { ensureNotNullish } from "@/type/utility";

const log = createLogger("store/audioContinuousPlayer");

type GenerateAudioResult = {
  stream: ReadableStream<Uint8Array>;
  startOffset: number;
};

/** 音声を再生しながら後続の音声を順番に取得する。 */
export async function playContinuously(
  audioKeys: AudioKey[],
  {
    fetchAudio,
    playAudioStream,
    onWaitStart,
  }: {
    fetchAudio: (params: {
      audioKey: AudioKey;
      abortSignal: AbortSignal;
    }) => Promise<GenerateAudioResult>;
    playAudioStream: (params: {
      audioKey: AudioKey;
      audio: GenerateAudioResult;
    }) => Promise<boolean>;
    onWaitStart: (audioKey: AudioKey) => void;
  },
) {
  const abortOnExit = new AbortController();
  using cancellables = new DisposableStack();
  cancellables.defer(() => {
    abortOnExit.abort();
  });

  // 1つ前の音声のストリームが終了してから次の音声のストリームを取得するPromiseのチェーン
  let previousStreamEnded = Promise.resolve();
  const pending = audioKeys.map((audioKey) => {
    const { promise: streamEnded, resolve: resolveStreamEnd } =
      Promise.withResolvers<void>();

    const prepared = previousStreamEnded
      .then(async (): Promise<Result<GenerateAudioResult> | undefined> => {
        log.info(`fetching audio for ${audioKey}`);

        const audio = await fetchAudio({
          audioKey,
          abortSignal: abortOnExit.signal,
        });
        if (abortOnExit.signal.aborted) {
          await audio.stream.cancel();
          return;
        }

        // ストリームを複製して、1つは再生用、もう1つは終了待ち用にする
        const [mainStream, endWaitStream] = audio.stream.tee();
        void consumeStream(endWaitStream, {
          signal: abortOnExit.signal,
        }).then(() => {
          log.info(`audio stream for ${audioKey} completed`);
          resolveStreamEnd();
        });

        return success({ ...audio, stream: mainStream });
      })
      // エラーはその音声の再生時に通知する。
      .catch((error: unknown) => failure(error as Error));

    previousStreamEnded = streamEnded;
    return prepared;
  });

  for (const [index, audioKey] of audioKeys.entries()) {
    onWaitStart(audioKey);
    const result = ensureNotNullish(await pending[index]);

    if (!result.ok) {
      throw result.error;
    }

    log.info(`playing audio for ${audioKey}`);
    const completed = await playAudioStream({
      audioKey,
      audio: result.value,
    });
    if (!completed) return;
  }
}
