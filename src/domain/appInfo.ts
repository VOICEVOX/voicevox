/** アプリの情報を返す */
export function getAppInfos() {
  return {
    name: import.meta.env.VITE_APP_NAME,
    version: import.meta.env.VITE_APP_VERSION,
  };
}
