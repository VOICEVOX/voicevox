import { getEngineAndVvppController } from "./engineAndVvppController";
import { IpcMainHandle } from "./ipc";
import type { WelcomeIpcIHData } from "@/welcome/ipcType";

export function getWelcomeIpcMainHandle(): IpcMainHandle<WelcomeIpcIHData> {
  const engineAndVvppController = getEngineAndVvppController();

  return {
    INSTALL_ENGINE: async (_, { filePath }) => {
      await engineAndVvppController.installVvppEngine({
        vvppPath: filePath,
        asDefaultVvppEngine: false,
        immediate: false,
      });
    },
  };
}
