// Include global variables to build immer source code
export * from "immer/src/types/globals";

declare global {
  interface HTMLAudioElement {
    setSinkId(deviceID: string): Promise<undefined>; // setSinkIdを認識してくれないため
  }
}
