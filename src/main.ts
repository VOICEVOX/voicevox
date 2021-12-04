import "source-map-support/register";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { store, storeKey } from "./store";
import { ipcMessageReceiver } from "./plugins/ipcMessageReceiverPlugin";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createGtm } from "@gtm-support/vue-gtm";

import { Quasar, Dialog, Loading } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "./styles/_index.scss";

createApp(App)
  .use(store, storeKey)
  .use(router)
  .use(
    createGtm({
      id: process.env.VUE_APP_GTM_CONTAINER_ID ?? "GTM-DUMMY",
      vueRouter: router,
      // NOTE: 現状、ElectronでGoogle Analyticsのopt-outが提供出来ない(起動時に設定が読めない)ため、
      //       設定が読める or 初期値の設定が出来るようになるまで無効にする
      // SEE: https://github.com/VOICEVOX/voicevox/pull/497#issuecomment-985721509
      // FIXME: Google Analyticsのopt-out方法の提供後削除
      enabled: false,
    })
  )
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
  .mount("#app");
