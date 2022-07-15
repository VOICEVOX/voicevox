import { test } from '@playwright/test';
import { assert } from "chai";
import { testWithPlaywright } from 'vue-cli-plugin-electron-builder';

test('launch app', async () => {
    const { app, stop } = await testWithPlaywright();

    // Get the first window that the app opens, wait if necessary.
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')

    assert.equal(await win.title(), 'voicevox')

    await stop()
})
