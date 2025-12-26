import { IpcIHData } from "../ipcType";

export type IpcRendererInvoke = {
  [K in keyof IpcIHData]: (
    ...args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]>;
};
