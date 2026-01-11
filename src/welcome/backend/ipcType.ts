import { EnginePackageStatus } from "@/backend/electron/engineAndVvppController";
import { EngineId } from "@/type/preload";
/**
 * invoke, handle
 */
export type WelcomeIpcIHData = {
  INSTALL_ENGINE: {
    args: [
      obj: {
        engineId: EngineId;
        target: string;
      },
    ];
    return: void;
  };
  FETCH_LATEST_ENGINE_PACKAGE_STATUSES: {
    args: [];
    return: EnginePackageStatus[];
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
