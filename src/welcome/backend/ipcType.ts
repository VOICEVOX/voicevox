import {
  EnginePackageLocalInfo,
  EnginePackageRemoteInfo,
} from "@/backend/electron/engineAndVvppController";
import { EngineId } from "@/type/preload";
import type { RuntimeTarget } from "@/domain/defaultEngine/latetDefaultEngine";
/**
 * invoke, handle
 */
export type WelcomeIpcIHData = {
  INSTALL_ENGINE: {
    args: [
      obj: {
        engineId: EngineId;
        target: RuntimeTarget;
      },
    ];
    return: void;
  };
  FETCH_ENGINE_PACKAGE_LOCAL_INFOS: {
    args: [];
    return: EnginePackageLocalInfo[];
  };
  FETCH_LATEST_ENGINE_PACKAGE_REMOTE_INFOS: {
    args: [];
    return: EnginePackageRemoteInfo[];
  };

  GET_CURRENT_THEME: {
    args: [];
    return: string;
  };

  SWITCH_TO_MAIN_WINDOW: {
    args: [];
    return: void;
  };
};

/**
 * send, on
 */
export type WelcomeIpcSOData = {
  UPDATE_ENGINE_DOWNLOAD_PROGRESS: {
    args: [
      obj: {
        engineId: EngineId;
        progress: number;
        type: "download" | "install";
      },
    ];
    return: void;
  };
};
