import type { PlaywrightTestConfig, Project } from "@playwright/test";

let project: Project;
const additionalWebServer: PlaywrightTestConfig["webServer"] = undefined;

if (process.env.VITE_TARGET == undefined) {
  throw new Error("VITE_TARGETの指定が必須です。");
} else if (process.env.VITE_TARGET == undefined) {
  throw new Error("VITE_TARGETの指定が必須です。");
} else if (process.env.VITE_TARGET === "electron") {
  project = { name: "electron" };
} else if (process.env.VITE_TARGET === "browser") {
  // エンジンの起動が必要
  project = { name: "browser" };
  additionalWebServer = {
    command: "vite --mode test",
    方針はこのあたり
    https://github.com/VOICEVOX/voicevox/issues/1418#issuecomment-1646608130
} else {
  throw new Error(`VITE_TARGETの指定が不正です。${process.env.VITE_TARGET}`);
}

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: "./tests/e2e",
  /* Maximum time one test can run for. */
  timeout: 120 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [project],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // outputDir: 'test-results/',

  webServer: {
    command: "vite --mode test",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
