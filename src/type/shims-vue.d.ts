/* eslint-disable */
declare module "*.vue" {
  // @ts-ignore
  import type { DefineComponent } from "vue";
  const component: DefineComponent<{}, {}, any>;

  export default component;
}

interface Window {
  readonly electron: import("./preload").Sandbox;
}
