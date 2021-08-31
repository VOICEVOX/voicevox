import "source-map-support/register";

import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { store, storeKey } from "./store";
import { ipcMessageReceiver } from "./plugins/ipcMessageReceiverPlugin";

import { Quasar, Dialog, Loading } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "./styles/_index.scss";

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
  .use(ipcMessageReceiver, { store: store })
  .mount("#app");
