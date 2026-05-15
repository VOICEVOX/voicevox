// eslint-disable-next-line no-restricted-imports
import { contextBridge, ipcRenderer } from "electron";
import {
  welcomeBridgeKey,
  type WelcomeSandboxWithTransferableResult,
} from "./backend/apiLoader";
import type { WelcomeIpcIHData } from "./backend/ipcType";
import type { WelcomeSandbox } from "./preloadType";
import {
  getOrThrowTransferableResult,
  wrapToTransferableResult,
} from "@/backend/electron/transferableResultHelper";
import type { EngineId } from "@/type/preload";

type WelcomeIpcRendererInvoke = {
  [K in keyof WelcomeIpcIHData]: (
    ...args: WelcomeIpcIHData[K]["args"]
  ) => Promise<WelcomeIpcIHData[K]["return"]>;
};

const ipcRendererInvokeProxy = new Proxy(
  {},
  {
    get:
      (_, channel: string) =>
      async (...args: unknown[]) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const transferableResult = await ipcRenderer.invoke(channel, ...args);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        return getOrThrowTransferableResult(transferableResult);
      },
  },
) as WelcomeIpcRendererInvoke;

const api: WelcomeSandbox = {
  installEngine: (obj) => {
    return ipcRendererInvokeProxy.INSTALL_ENGINE(obj);
  },
  getDownloadableDefaultEnginePackageIds: () => {
    return ipcRendererInvokeProxy.GET_DOWNLOADABLE_DEFAULT_ENGINE_PACKAGE_IDS();
  },
  getEnginePackageEmbeddedInfo: (engineId) => {
    return ipcRendererInvokeProxy.GET_ENGINE_PACKAGE_EMBEDDED_INFO({
      engineId,
    });
  },
  getEnginePackageCurrentInfo: (engineId) => {
    return ipcRendererInvokeProxy.GET_ENGINE_PACKAGE_CURRENT_INFO({ engineId });
  },
  getEnginePackageLatestInfo: (engineId) => {
    return ipcRendererInvokeProxy.GET_ENGINE_PACKAGE_LATEST_INFO({ engineId });
  },
  launchMainWindow: () => {
    return ipcRendererInvokeProxy.SWITCH_TO_MAIN_WINDOW();
  },
  getCurrentTheme: () => {
    return ipcRendererInvokeProxy.GET_CURRENT_THEME();
  },
  registerIpcHandler: (listeners) => {
    const {
      updateEngineDownloadProgress,
      detectMaximized,
      detectUnmaximized,
      detectEnterFullscreen,
      detectLeaveFullscreen,
    } = listeners;
    if (updateEngineDownloadProgress) {
      ipcRenderer.on("UPDATE_ENGINE_DOWNLOAD_PROGRESS", (_, args) => {
        updateEngineDownloadProgress(
          args as {
            engineId: EngineId;
            progress: number;
            type: "download" | "install";
          },
        );
      });
    }
    if (detectMaximized) {
      ipcRenderer.on("DETECT_MAXIMIZED", () => {
        detectMaximized();
      });
    }
    if (detectUnmaximized) {
      ipcRenderer.on("DETECT_UNMAXIMIZED", () => {
        detectUnmaximized();
      });
    }
    if (detectEnterFullscreen) {
      ipcRenderer.on("DETECT_ENTER_FULLSCREEN", () => {
        detectEnterFullscreen();
      });
    }
    if (detectLeaveFullscreen) {
      ipcRenderer.on("DETECT_LEAVE_FULLSCREEN", () => {
        detectLeaveFullscreen();
      });
    }
  },
  isMaximizedWindow: () => {
    return ipcRendererInvokeProxy.IS_MAXIMIZED_WINDOW();
  },
  minimizeWindow: () => {
    return ipcRendererInvokeProxy.MINIMIZE_WINDOW();
  },
  toggleMaximizeWindow: () => {
    return ipcRendererInvokeProxy.TOGGLE_MAXIMIZE_WINDOW();
  },
  closeWindow: () => {
    return ipcRendererInvokeProxy.CLOSE_WINDOW();
  },

  logError: (...params) => {
    console.error(...params);
    ipcRenderer.send("__ELECTRON_LOG__", {
      data: [...params],
      level: "error",
    });
  },

  logWarn: (...params) => {
    console.warn(...params);
    ipcRenderer.send("__ELECTRON_LOG__", {
      data: [...params],
      level: "warn",
    });
  },

  logInfo: (...params) => {
    console.info(...params);
    ipcRenderer.send("__ELECTRON_LOG__", {
      data: [...params],
      level: "info",
    });
  },
};

const wrapApi = (
  baseApi: WelcomeSandbox,
): WelcomeSandboxWithTransferableResult => {
  const wrappedApi = {} as WelcomeSandboxWithTransferableResult;
  for (const key in baseApi) {
    const propKey = key as keyof WelcomeSandboxWithTransferableResult;
    // @ts-expect-error とりあえず動くので無視
    wrappedApi[propKey] = async (...args: unknown[]) => {
      // @ts-expect-error とりあえず動くので無視
      return wrapToTransferableResult(() => baseApi[propKey](...args));
    };
  }
  return wrappedApi;
};

contextBridge.exposeInMainWorld(welcomeBridgeKey, wrapApi(api));
