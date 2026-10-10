import type { StorePlugins } from "./vuex";
import { showAlertDialog } from "@/components/Dialog/Dialog";
import { createLogger } from "@/helpers/log";
import { Mutex } from "@/helpers/mutex";

const logger = createLogger("store/audioContext");
const context = window.AudioContext ? new AudioContext() : undefined;
const sinkIdMutex = new Mutex();

export function isAudioContextAvailable(): boolean {
  return context != undefined;
}

export function audioContext(): AudioContext {
  if (context == undefined) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  // TODO: interruptedも考慮する
  if (context.state === "suspended") {
    void context.resume().catch((error: unknown) => {
      logger.error("Failed to resume AudioContext.", error);
      void showAlertDialog({
        title: "エラー",
        message: "音声の再生を開始できませんでした",
      });
    });
  }
  return context;
}

async function setAudioContextSinkId(device: string): Promise<void> {
  if (!context?.setSinkId) return;
  await using _lock = await sinkIdMutex.acquire();
  const sinkId = device === "default" ? "" : device;
  try {
    await context.setSinkId(sinkId);
  } catch (error) {
    logger.error("Failed to set AudioContext sinkId.", error);
    void showAlertDialog({
      title: "エラー",
      message: "再生デバイスが見つかりません",
    });
  }
}

export const audioContextStorePlugins: StorePlugins = [
  (store) => {
    store.watch(
      (state) => state.savingSetting.audioOutputDevice,
      (device) => {
        void setAudioContextSinkId(device);
      },
      { immediate: true },
    );
  },
];
