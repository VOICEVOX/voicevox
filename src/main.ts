import { createApp } from "vue";
import { createGtm } from "@gtm-support/vue-gtm";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { store, storeKey } from "./store";
import { ipcMessageReceiver } from "./plugins/ipcMessageReceiverPlugin";
import { hotkeyPlugin } from "./plugins/hotkeyPlugin";
import { generateColorPalette } from "./helpers/colors";
import App from "@/components/App.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "./styles/_index.scss";

// NOTE: 起動後、設定を読み込んでからvue-gtmを有効化する関係上、dataLayerの用意が間に合わず、値が欠落してしまう箇所が存在する
//       ため、それを防止するため自前でdataLayerをあらかじめ用意する
window.dataLayer = [];

const colorConfig = {
  sourceColor: "#a5d4ad",
  primaryHue: {
    light: 260,
    dark: 240,
  },
  secondaryHue: {
    light: 200,
    dark: 180,
  },
  tertiaryHue: {
    light: 180,
    dark: 160,
  },
  neutral: {
    light: 200,
    dark: 800,
  },
  neutralVariant: {
    light: 200,
    dark: 800,
  },
  customColors: {
    error: "#B3261E",
    success: "#198754",
  },
};

// カラーパレットを生成
const colorPalette = generateColorPalette(colorConfig);

// CSS 変数に設定
function applyColorPalette(palette: { [key: string]: number }) {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(
      `--md-sys-color-${key}`,
      `#${value.toString(16).padStart(8, "0").slice(2)}`,
    );
  }
}

// ライトテーマとダークテーマの切り替え
function applyTheme(isDark: boolean) {
  const palette = isDark ? colorPalette.dark : colorPalette.light;
  applyColorPalette(palette);
}

// 初期テーマを適用
applyTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);

// テーマ切り替えイベントリスナー
window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", (event) => {
    applyTheme(event.matches);
});

createApp(App)
  .use(store, storeKey)
  .use(
    createGtm({
      id: import.meta.env.VITE_GTM_CONTAINER_ID ?? "GTM-DUMMY",
      // NOTE: 最初はgtm.jsを読まず、プライバシーポリシーに同意後に読み込む
      enabled: false,
    }),
  )
  .use(Quasar, {
    config: {
      brand: {
        primary: "#a5d4ad",
        secondary: "#212121",
        negative: "var(--color-warning)",
      },
    },
    iconSet,
    plugins: {
      Dialog,
      Loading,
      Notify,
    },
  })
  .use(hotkeyPlugin)
  .use(ipcMessageReceiver, { store })
  .use(markdownItPlugin)
  .mount("#app");
