import type { IpcIHData } from "@/type/ipc";

type SandboxImpl = {
  [K in keyof IpcIHData]: (
    args: IpcIHData[K]["args"]
  ) => Promise<IpcIHData[K]["return"]>;
};

export const getAppInfosImpl: SandboxImpl["GET_APP_INFOS"] = () => {
  /* eslint-disable @typescript-eslint/no-non-null-assertion */
  const appInfo = {
    name: process.env.APP_NAME!,
    version: process.env.APP_VERSION!,
  };
  /* eslint-enable @typescript-eslint/no-non-null-assertion */
  return Promise.resolve(appInfo);
};
