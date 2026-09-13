import { setup, type Preview } from "@storybook/vue3-vite";
import { onMounted, onUnmounted } from "vue";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { withThemeByDataAttribute } from "@storybook/addon-themes";
import { addActionsWithEmits } from "./utils/argTypesEnhancers";
import { store, storeKey } from "@/store";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createThemePlugin, useThemeSetting } from "@/plugins/themePlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "@/styles/_index.scss";
import { setFontToCss } from "@/domain/dom";
import { themeSettingSchema } from "@/type/preload";

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
  app.use(store, storeKey);
  app.use(
    createThemePlugin({
      type: "controlled",
      initialTheme: "Default",
    }),
  );
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
        light: "Default",
        dark: "Dark",
      },
      defaultTheme: "light",
      attributeName: "data-storybook-theme",
    }),

    // テーマの設定をCSSへ反映する
    () => {
      return {
        setup() {
          const { setCurrentTheme } = useThemeSetting();
          const applyTheme = async () => {
            const themeSetting = themeSettingSchema.parse(
              document.documentElement.getAttribute("data-storybook-theme"),
            );
            await setCurrentTheme(themeSetting);
          };
          const root = document.documentElement;
          const observer = new MutationObserver(() => {
            void applyTheme();
          });
          onMounted(async () => {
            setFontToCss("default");

            observer.observe(root, {
              attributes: true,
              attributeFilter: ["data-storybook-theme"],
            });
            await applyTheme();
          });
          onUnmounted(() => {
            observer.disconnect();
          });
        },

        template: `<story />`,
      };
    },
  ],
  argTypesEnhancers: [addActionsWithEmits],
};

export default preview;
