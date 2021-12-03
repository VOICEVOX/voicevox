import "source-map-support/register";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { store, storeKey } from "./store";
import { ipcMessageReceiver } from "./plugins/ipcMessageReceiverPlugin";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createI18n } from "vue-i18n";
import messages from "@/i18n";

import { Quasar, Dialog, Loading } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "./styles/_index.scss";

type MessageSchema = typeof messages["ja"];
const i18n = createI18n<[MessageSchema], "en" | "ja">({
  legacy: false,
  locale: "en",
  fallbackLocale: "ja",
  messages,
});

createApp(App)
  .use(store, storeKey)
  .use(router)
  .use(Quasar, {
    config: {
      brand: {
        primary: "#a5d4ad",
        secondary: "#212121",
      },
    },
    iconSet,
    plugins: {
      Dialog,
      Loading,
    },
  })
  .use(ipcMessageReceiver, { store })
  .use(markdownItPlugin)
  .use(i18n)
  .mount("#app");
