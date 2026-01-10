import { EngineId } from "@/type/preload";
import { Result } from "@/type/result";
/**
 * invoke, handle
 */
export type WelcomeIpcIHData = {
  INSTALL_ENGINE: {
    args: [obj: { filePath: string }];
    return: void;
  };
};

/**
 * send, on
 */
export type WelcomeIpcSOData = {
  UPDATE_ENGINE_DOWNLOAD_PROGRESS: {
    args: [obj: { engineId: EngineId; progress: number }];
    return: void;
  };
};
