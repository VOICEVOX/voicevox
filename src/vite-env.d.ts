/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_7Z_BIN_NAME: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_DEFAULT_ENGINE_INFOS: string;
  readonly VITE_GTM_CONTAINER_ID: string;
  readonly VITE_TARGET: "electron" | "browser";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
