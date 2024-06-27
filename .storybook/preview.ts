import { setup, Preview } from '@storybook/vue3';
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "../src/styles/_index.scss";

import { addActionsWithEmits } from './utils/argTypesEnhancers';



setup((app) => {
  app.use(Quasar, {
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
  app.use(markdownItPlugin)
})


const preview: Preview = {
  tags: ['autodocs'],
  argTypesEnhancers: [
    addActionsWithEmits,
  ],
};

export default preview;
