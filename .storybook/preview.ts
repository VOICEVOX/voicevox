import { setup, type Preview, type StoryContext } from "@storybook/vue3-vite";
import { onMounted, onUnmounted } from "vue";
import { Quasar, Dialog, Loading, Notify } from "quasar";
import iconSet from "quasar/icon-set/material-icons";
import {
  DecoratorHelpers,
  withThemeByDataAttribute,
} from "@storybook/addon-themes";
import { z } from "zod";
import { addActionsWithEmits } from "./utils/argTypesEnhancers";
import { store, storeKey } from "@/store";
import { markdownItPlugin } from "@/plugins/markdownItPlugin";
import { createThemePlugin, useThemeSetting } from "@/plugins/themePlugin";

import "@quasar/extras/material-icons/material-icons.css";
import "quasar/dist/quasar.sass";
import "@/styles/_index.scss";
import { setFontToCss } from "@/domain/dom";
import { themeSettingSchema, type ThemeSetting } from "@/type/preload";

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

const storybookThemes = {
  light: "Default",
  dark: "Dark",
} satisfies Record<string, ThemeSetting>;
const defaultStorybookTheme = "light";
const storybookThemeNameSchema = z.enum(["light", "dark"]);
const storybookThemeAttributeName = "data-storybook-theme";

type StoryContextWithThemeParameters = StoryContext & {
  parameters: {
    themes?: {
      themeOverride?: string;
    };
  };
};

const resolveInitialThemeSetting = (
  context: StoryContextWithThemeParameters,
): ThemeSetting => {
  const themeOverride = context.parameters.themes?.themeOverride;
  const selectedTheme = DecoratorHelpers.pluckThemeFromContext(context);
  let themeName = defaultStorybookTheme;
  if (themeOverride != undefined && themeOverride !== "") {
    themeName = themeOverride;
  } else if (selectedTheme !== "") {
    themeName = selectedTheme;
  }
  const validThemeName = storybookThemeNameSchema.parse(themeName);
  return storybookThemes[validThemeName];
};

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
      themes: storybookThemes,
      defaultTheme: defaultStorybookTheme,
      attributeName: storybookThemeAttributeName,
    }),

    // テーマの設定をCSSへ反映する
    (_, context) => {
      const initialThemeSetting = resolveInitialThemeSetting(context);
      return {
        setup() {
          const { setCurrentTheme } = useThemeSetting();
          const root = document.documentElement;
          const applyTheme = async () => {
            const themeSetting = themeSettingSchema.parse(
              root.getAttribute(storybookThemeAttributeName),
            );
            await setCurrentTheme(themeSetting);
          };
          const observer = new MutationObserver(() => {
            void applyTheme();
          });
          onMounted(async () => {
            setFontToCss("default");
            root.setAttribute(storybookThemeAttributeName, initialThemeSetting);

            observer.observe(root, {
              attributes: true,
              attributeFilter: [storybookThemeAttributeName],
            });
            await setCurrentTheme(initialThemeSetting);
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
