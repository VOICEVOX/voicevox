import { setup, type Preview } from "@storybook/vue3-vite";
import { onMounted, watch } from "vue";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import { DecoratorHelpers } from "@storybook/addon-themes";
import { z } from "zod";
import { addActionsWithEmits } from "./utils/argTypesEnhancers";
import { store, storeKey } from "@/store";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { themePlugin, useTheme } from "@/plugins/themePlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "@/styles/_index.scss";
import { setFontToCss } from "@/domain/dom";
import type { ThemeSetting } from "@/type/preload";

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
  app.use(themePlugin, {
    getAvailableThemes: () => store.state.availableThemes,
  });
});

const storybookThemes = {
  light: "Default",
  dark: "Dark",
} satisfies Record<string, ThemeSetting>;
const defaultStorybookTheme = "light";
const storybookThemeNameSchema = z.enum(["light", "dark"]);

DecoratorHelpers.initializeThemeState(
  Object.keys(storybookThemes),
  defaultStorybookTheme,
);

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
    // テーマの設定をCSSへ反映する
    (_, context) => {
      return {
        setup() {
          const { setCurrentTheme } = useTheme();
          watch(
            () => {
              const themeName = [
                z
                  .object({ themeOverride: z.unknown() })
                  .nullish()
                  .parse(context.parameters.themes)?.themeOverride,
                DecoratorHelpers.pluckThemeFromContext(context),
                defaultStorybookTheme,
              ].find((candidate) => candidate != undefined && candidate !== "");
              const validThemeName = storybookThemeNameSchema.parse(themeName);
              return storybookThemes[validThemeName];
            },
            setCurrentTheme,
            { immediate: true },
          );
          onMounted(() => {
            setFontToCss("default");
          });
        },

        template: `<story />`,
      };
    },
  ],
  argTypesEnhancers: [addActionsWithEmits],
};

export default preview;
