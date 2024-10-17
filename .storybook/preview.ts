import { setup, Preview } from "@storybook/vue3";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { addActionsWithEmits } from "./utils/argTypesEnhancers";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { api as browserSandbox } from "@/backend/browser/sandbox";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "../src/styles/_index.scss";
import { UnreachableError } from "@/type/utility";
import { setThemeToCss } from "@/domain/dom";

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
  });
  app.use(markdownItPlugin);
});

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    docs: {
      toc: true,
    },
    backgrounds: {
      default: "theme",
      values: [
        {
          name: "theme",
          value: "var(--color-v2-background)",
        },
        {
          name: "light",
          value: "#fff",
        },
        {
          name: "dark",
          value: "#333",
        },
      ],
    },
  },
  decorators: [
    withThemeByDataAttribute({
      themes: {
        light: "false",
        dark: "true",
      },
      defaultTheme: "light",
      attributeName: "is-dark-theme",
    }),
    () => {
      let observer: MutationObserver | undefined = undefined;
      return {
        async mounted() {
          const root = document.documentElement;
          const themes = await browserSandbox.getAvailableThemes();
          observer = new MutationObserver(() => {
            if (!observer)
              throw new UnreachableError("assert: observer !== undefined");

            const isDark = root.getAttribute("is-dark-theme") === "true";
            const theme = themes.find((theme) => theme.isDark === isDark);
            if (!theme)
              throw new UnreachableError("assert: theme !== undefined");

            observer.disconnect();

            setThemeToCss(theme);

            observer.observe(root, {
              attributes: true,
              attributeFilter: ["is-dark-theme"],
            });
          });

          observer.observe(root, {
            attributes: true,
            attributeFilter: ["is-dark-theme"],
          });
        },
        unmounted() {
          if (observer) {
            observer.disconnect();
          }
        },

        template: `<story />`
      };
    },
  ],
  argTypesEnhancers: [addActionsWithEmits],
};

export default preview;
