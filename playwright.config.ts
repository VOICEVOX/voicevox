/**
 * e2eテストと .env の設計：
 * - デフォルトで .env.test を読み込む。
 *   モックエンジンが使われる。
 * - Electronテストはテストファイル内で様々な .env を読み込む。
 *   テスト条件によって用意したい環境が異なるため。
 */

import type { PlaywrightTestConfig, Project } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test", override: true });

let project: Project;
let webServers: PlaywrightTestConfig["webServer"];
const isElectron = process.env.VITE_TARGET === "electron";
const isBrowser = process.env.VITE_TARGET === "browser";
const isStorybook = process.env.TARGET === "storybook";

const viteServer = {
  command: "vite --mode test --port 7357",
  port: 7357,
  reuseExistingServer: !process.env.CI,
};
const storybookServer = {
  command: "storybook dev --ci --port 7357",
  port: 7357,
  reuseExistingServer: !process.env.CI,
};

if (isElectron) {
  project = { name: "electron", testDir: "./tests/e2e/electron" };
  webServers = [viteServer];
} else if (isBrowser) {
  project = { name: "browser", testDir: "./tests/e2e/browser" };
  webServers = [viteServer];
} else if (isStorybook) {
  project = { name: "storybook", testDir: "./tests/e2e/storybook" };
  webServers = [storybookServer];
} else {
  throw new Error(`VITE_TARGETの指定が不正です。${process.env.VITE_TARGET}`);
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: "./tests/e2e",
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  globalTimeout: 5 * 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5 * 1000,
  },
  // ファイルシステムが関連してくるので、Electronテストでは並列化しない
  fullyParallel: !isElectron,
  workers: isElectron ? 1 : undefined,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["html", { open: "never" }], ["github"]]
    : [["html", { open: "on-failure" }]],
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    video: {
      mode: "retain-on-failure",
    },
  },

  /* Configure projects for major browsers */
  projects: [project],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',

  webServer: webServers,
};

export default config;
