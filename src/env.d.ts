/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GTM_CONTAINER_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
