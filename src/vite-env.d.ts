/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_7Z_BIN_NAME: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_DEFAULT_ENGINE_INFOS: string;
  readonly VITE_DEV_SERVER_URL: string | undefined;
  readonly VITE_OFFICIAL_WEBSITE_URL: string;
  readonly VITE_LATEST_UPDATE_INFOS_URL: string;
  readonly VITE_GTM_CONTAINER_ID: string;
  readonly VITE_TARGET: "electron" | "browser";
  readonly VITE_EXTRA_VERSION_INFO: string | undefined;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
