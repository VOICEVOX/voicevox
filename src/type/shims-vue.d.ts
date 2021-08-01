/* eslint-disable */
declare module "*.vue" {
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;
  export default component;

  declare global {
    interface Window {
      readonly electron: import("./preload").Sandbox;
    }
  }
}

declare global {
  interface Window {
    readonly electron: import("./preload").Sandbox;
  }
}
