import { defineConfig } from "vize";

export default defineConfig(() => ({
  compiler: {
    templateSyntax: "quirks",
  },
  linter: {
    typeAware: true,
    rules: {
      // Vizeの機能不足系
      // 本当はcamelCaseにしたい
      "vue/attribute-hyphenation": "off",

      // viteのimportは許してほしい（Vueにファイルパスを書くと解決されたりするのかな）
      "vue/no-unsafe-url": "off",

      // False Positive系
      // Storybookのcomponentを対象にしてしまっている！
      "script/no-potential-component-option-typo": "off",

      // propsとしてのanchorはHTMLのanchorではない
      // src/components/Talk/AudioParameter.vue:26 など
      "a11y/no-refer-to-non-existent-id": "off",

      // <p>の中にtemplateで要素を構築するみたいなことをしていると空のpと判定される
      "html/no-empty-palpable-content": "off",

      // コードベースが悪い系
      // MenuBarでnon-scoped styleを使っている、がこれなんとかできないのかなぁ
      "vue/require-scoped-style": "off",

      // Electronでそれ必要～？
      "vue/no-template-target-blank": "off",

      // labelにforをつけるべき！
      "a11y/label-has-for": "off",

      // tabindexはちゃんとつけるべき！
      "a11y/interactive-supports-focus": "off",

      // a11yは一旦無効
      // そのうち有効にしたいかも
      "a11y/mouse-events-have-key-events": "off",
      "a11y/no-static-element-interactions": "off",
      "a11y/click-events-have-key-events": "off",
      "a11y/no-i-for-icon": "off",
      "a11y/img-alt": "off",
      "a11y/alt-text": "off",
      "a11y/form-control-has-label": "off",
    },
  },
}));
