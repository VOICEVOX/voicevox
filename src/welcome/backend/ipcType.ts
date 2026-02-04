import type {
  EnginePackageLocalInfo,
  EnginePackageRemoteInfo,
} from "@/backend/electron/engineAndVvppController";
import type { EngineId } from "@/type/preload";
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
  MINIMIZE_WINDOW: {
    args: [];
    return: void;
  };
  TOGGLE_MAXIMIZE_WINDOW: {
    args: [];
    return: void;
  };
  CLOSE_WINDOW: {
    args: [];
    return: void;
  };
  IS_MAXIMIZED_WINDOW: {
    args: [];
    return: boolean;
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
  DETECT_MAXIMIZED: {
    args: [];
    return: void;
  };
  DETECT_UNMAXIMIZED: {
    args: [];
    return: void;
  };
  DETECT_ENTER_FULLSCREEN: {
    args: [];
    return: void;
  };
  DETECT_LEAVE_FULLSCREEN: {
    args: [];
    return: void;
  };
};
