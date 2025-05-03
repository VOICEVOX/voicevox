import { IpcIHData } from "@/type/ipc";

export type IpcRendererInvoke = {
  [K in keyof IpcIHData]: (
    ...args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]>;
};
