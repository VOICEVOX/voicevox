import { type TestRunnerConfig } from "@storybook/test-runner";

const config: TestRunnerConfig = {
  async preVisit(page) {
    // テスト用のスナップショット関数を追加する。
    // *.stories.ts内で`window.storybookTestSnapshot`を使って呼び出せる。
    if (await page.evaluate(() => !("storybookTestSnapshot" in window))) {
      await page.exposeBinding(
        "storybookTestSnapshot",
        async (_, obj: unknown) => {
          expect(obj).toMatchSnapshot();
        },
      );
    }
  },
};

export default config;
