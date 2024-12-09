import { setup, Preview } from "@storybook/vue3";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { addActionsWithEmits } from "./utils/argTypesEnhancers";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "@/styles/_index.scss";
import { UnreachableError } from "@/type/utility";
import { setThemeToCss, setFontToCss } from "@/domain/dom";
import { themes } from "@/domain/theme";

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
      grid: {
        cellSize: 8,
        cellAmount: 4,
        opacity: 0.1,
      },
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

    // テーマの設定をCSSへ反映する
    () => {
      let observer: MutationObserver | undefined = undefined;
      return {
        async mounted() {
          setFontToCss("default");

          const root = document.documentElement;
          let lastIsDark: boolean | undefined = undefined;
          observer = new MutationObserver(() => {
            const isDark = root.getAttribute("is-dark-theme") === "true";
            if (lastIsDark === isDark) return;
            lastIsDark = isDark;

            const theme = themes.find((theme) => theme.isDark === isDark);
            if (!theme)
              throw new UnreachableError("assert: theme !== undefined");

            setThemeToCss(theme);
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

        template: `<story />`,
      };
    },
  ],
  argTypesEnhancers: [addActionsWithEmits],
};

export default preview;
