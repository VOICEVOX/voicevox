import { getAppInfosImpl } from "./backgroundImpl";
import type { MainToWorkerMessage } from "./type";
import type { IpcIHData } from "@/type/ipc";

type MessageReturnTypes = { [K in keyof IpcIHData]: IpcIHData[K]["return"] };

const typedPostMessage = <K extends keyof MessageReturnTypes>(
  message: MessageReturnTypes[K]
) => {
  postMessage(message);
};

onmessage = (e: MessageEvent<MainToWorkerMessage>) => {
  switch (e.data.type) {
    case "GET_APP_INFOS":
      return getAppInfosImpl(e.data.args).then((v) =>
        typedPostMessage<typeof e.data.type>(v)
      );
    default:
      console.dir(e.data);
      postMessage({ type: e.data.type, return: [], eventId: e.data.eventId });
      break;
  }
};
