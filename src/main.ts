import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { store, storeKey } from "./store";

import VueMaterialAdapter from "vue-material-adapter";

createApp(App)
  .use(store, storeKey)
  .use(router)
  .use(VueMaterialAdapter)
  .mount("#app");
