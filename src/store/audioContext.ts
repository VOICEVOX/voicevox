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

export function getAudioContext(): AudioContext {
  if (context == undefined) {
    throw new Error("AudioContext is not supported in this browser.");
  }
  return context;
}

export const audioContextStorePlugins: StorePlugins = [
  (store) => {
    store.watch(
      (state) => state.savingSetting.audioOutputDevice,
      async (device) => {
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
      },
      { immediate: true },
    );
  },
];
