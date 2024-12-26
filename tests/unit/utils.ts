import { QPageContainer, QLayout } from "quasar";
import { Component } from "vue";

// QPageContainerとQLayoutで囲うためのヘルパー関数。
// QPageはQLayout > QPageContainer > QPageの構造にしないとエラーになるため必要。
export function wrapQPage(page: Component) {
  return {
    template: `
      <QLayout>
        <QPageContainer>
          <page />
        </QPageContainer>
      </QLayout>
    `,
    components: {
      page,
      QPageContainer,
      QLayout,
    },
  };
}

/** バイナリからSHA-256ハッシュを計算する */
export async function hash(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
