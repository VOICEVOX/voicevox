import { IpcIHData } from "@/type/ipc";

export type WorkerToMainMessage = {
  [K in keyof IpcIHData]: {
    type: K;
    return: IpcIHData[K]["return"];
    eventId: string;
  };
}[keyof IpcIHData];

export type MainToWorkerMessage = {
  [K in keyof IpcIHData]: {
    type: K;
    args: IpcIHData[K]["args"];
    eventId: string;
  };
}[keyof IpcIHData];
