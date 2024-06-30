import { createApp } from "vue";
import { createGtm } from "@gtm-support/vue-gtm";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { store, storeKey } from "./store";
import { ipcMessageReceiver } from "./plugins/ipcMessageReceiverPlugin";
import { hotkeyPlugin } from "./plugins/hotkeyPlugin";
import { generateTheme, themeToCssVariables } from "./helpers/colors";
import App from "@/components/App.vue";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "./styles/_index.scss";

// NOTE: 起動後、設定を読み込んでからvue-gtmを有効化する関係上、dataLayerの用意が間に合わず、値が欠落してしまう箇所が存在する
//       ため、それを防止するため自前でdataLayerをあらかじめ用意する
window.dataLayer = [];

// ブランドカラー
const sourceColor = "#A5D4AD";
// パレットの調整
const adjustments = {
  neutral: { chroma: -5, tone: 0 },
  neutralVariant: { chroma: -1, tone: 0 },
};
// カスタムカラー(仮)
const customColors: CustomColor[] = [
  {
    name: "sing-toolbar",
    palette: "neutral",
    lightTone: 99,
    darkTone: 20,
    blend: true,
  },
  {
    name: "sing-ruler",
    palette: "neutralVariant",
    lightTone: 90,
    darkTone: 10,
    blend: true,
  },
  {
    name: "cell-white",
    palette: "neutral",
    lightTone: 100,
    darkTone: 15,
    blend: true,
  },
  {
    name: "cell-black",
    palette: "neutral",
    lightTone: 96,
    darkTone: 12,
    blend: true,
  },
  {
    name: "sing-grid-measure-line",
    palette: "neutral",
    lightTone: 70,
    darkTone: 40,
    blend: true,
  },
  {
    name: "sing-grid-beat-line",
    palette: "neutral",
    lightTone: 90,
    darkTone: 0,
    blend: true,
  },
  {
    name: "sing-piano-key-white",
    palette: "neutral",
    lightTone: 100,
    darkTone: 80,
    blend: true,
  },
  {
    name: "sing-piano-key-black",
    palette: "neutral",
    lightTone: 50,
    darkTone: 30,
    blend: true,
  },
];
const theme = generateTheme(sourceColor, adjustments, customColors);
const cssVariables = themeToCssVariables(theme, false);

// CSSに適用する
Object.entries(cssVariables).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value);
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
