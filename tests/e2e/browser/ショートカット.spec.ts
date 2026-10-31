import { test, expect, type Page } from "@playwright/test";

import { gotoHome, navigateToMain, navigateToSong } from "../navigators";
import { getNewestQuasarDialog, getQuasarMenu } from "../locators";
import { fillAudioCell, waitForUiUnlock } from "./utils";

test.beforeEach(gotoHome);

async function changeHotkey(
  page: Page,
  action: string,
  beforeKey: string,
  afterKey: string,
) {
  await test.step(`${action}のキー割り当てを変更する`, async () => {
    await page.getByRole("button", { name: "設定", exact: true }).click();
    await getQuasarMenu(page, "キー割り当て").click();
    const settingDialog = getNewestQuasarDialog(page);
    await settingDialog
      .locator(".table-row")
      .filter({ has: page.getByText(action, { exact: true }) })
      .getByRole("button", { name: beforeKey, exact: true })
      .click();
    await expect(
      page.getByText("ショートカットキーを入力してください"),
    ).toBeVisible();
    await page.keyboard.press(afterKey);
    await getNewestQuasarDialog(page)
      .getByRole("button", { name: "OK", exact: true })
      .click();
    await expect(
      page.getByText("ショートカットキーを入力してください"),
    ).not.toBeVisible();
    await settingDialog
      .getByRole("button")
      .filter({ hasText: "close" })
      .click();
    await expect(settingDialog).not.toBeVisible();
  });
}

test("Spaceでトークの再生・停止ができる", async ({ page }) => {
  await navigateToMain(page);

  const audioDetail = page.getByTestId("audio-detail");
  const playButton = audioDetail
    .getByRole("button")
    .filter({ hasText: "play_arrow" });
  const stopButton = audioDetail
    .getByRole("button")
    .filter({ hasText: "stop" });

  await test.step("テキストを入力して入力欄からフォーカスを外す", async () => {
    await fillAudioCell(
      page,
      0,
      "あれもこれもそれもどれも、あれもこれもそれもどれも。",
    );
    await page.locator(".audio-cell").first().focus();
    await expect(playButton).toBeVisible();
  });
  await waitForUiUnlock(page);

  await test.step("Spaceで再生する", async () => {
    await page.keyboard.press("Space");
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toBeEnabled();
    await expect(audioDetail.locator(".accent-phrase").nth(1)).toHaveClass(
      /accent-phrase-focus/,
    );
  });

  await test.step("Spaceをもう一度押すと停止する", async () => {
    await page.keyboard.press("Space");
    await expect(playButton).toBeVisible();
    await expect(stopButton).not.toBeVisible();
  });
});

test("Spaceでソングの再生・停止ができる", async ({ page }) => {
  await navigateToSong(page);

  const playButton = page.getByRole("button").filter({ hasText: "play_arrow" });
  const stopButton = page.getByRole("button").filter({ hasText: "stop" });

  await test.step("ノートを追加する", async () => {
    const sequencer = page.getByLabel("シーケンサ");
    await sequencer.click({ position: { x: 100, y: 171 } });
    await expect(sequencer.locator(".note")).toHaveCount(1);
    await expect(playButton).toBeVisible();
  });

  await test.step("Spaceで再生する", async () => {
    await page.keyboard.press("Space");
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toBeEnabled();
  });

  await test.step("Spaceをもう一度押すと停止する", async () => {
    await page.keyboard.press("Space");
    await expect(playButton).toBeVisible();
    await expect(stopButton).not.toBeVisible();
  });
});

test("入力欄内でShift+Enterによる追加とShift+Deleteによる削除ができる", async ({
  page,
}) => {
  await navigateToMain(page);
  await waitForUiUnlock(page);

  const audioCells = page.locator(".audio-cell");
  const firstInput = page.getByRole("textbox", { name: "1行目", exact: true });
  const secondInput = page.getByRole("textbox", { name: "2行目", exact: true });

  await test.step("入力欄内でShift+Enterを押すとテキスト欄が増える", async () => {
    await firstInput.fill("テストです");
    await expect(firstInput).toBeFocused();
    await firstInput.press("Shift+Enter");
    await expect(audioCells).toHaveCount(2);
    await expect(firstInput).toHaveValue("テストです");
    await expect(secondInput).toBeFocused();
  });
  await waitForUiUnlock(page);

  await test.step("入力欄内でShift+Deleteを押すとテキスト欄が減る", async () => {
    await secondInput.press("Shift+Delete");
    await expect(audioCells).toHaveCount(1);
    await expect(firstInput).toHaveValue("テストです");
  });
});

test("Escapeでテキスト欄からフォーカスを外せる", async ({ page }) => {
  await navigateToMain(page);
  await waitForUiUnlock(page);

  await test.step("入力欄内でEscapeを押すとフォーカスが外れる", async () => {
    const input = page.getByRole("textbox", { name: "1行目", exact: true });
    await input.fill("テストです");
    await expect(input).toBeFocused();
    await input.press("Escape");
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue("テストです");
  });
});

test("Ctrl+ZまたはCmd+Zは入力欄外でだけテキスト欄の追加を元に戻す", async ({
  page,
}) => {
  await navigateToMain(page);

  const audioCells = page.locator(".audio-cell");

  await test.step("テキスト欄を追加する", async () => {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await expect(audioCells).toHaveCount(2);
  });
  await waitForUiUnlock(page);

  await test.step("入力欄内でCtrlまたはMeta+Zを押してもテキスト欄は減らない", async () => {
    const input = page.getByRole("textbox", { name: "2行目", exact: true });
    await expect(input).toBeFocused();
    await input.press("ControlOrMeta+Z");
    await expect(audioCells).toHaveCount(2);
    await expect(input).toBeFocused();
  });

  await test.step("CtrlまたはMeta+Zで追加を元に戻す", async () => {
    await audioCells.last().focus();
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(audioCells).toHaveCount(1);
  });
});

test("CtrlまたはMeta+Zは入力欄外でだけノートの追加を元に戻す", async ({
  page,
}) => {
  await navigateToSong(page);

  const sequencer = page.getByLabel("シーケンサ");
  const notes = sequencer.locator(".note");

  await test.step("ノートを追加する", async () => {
    await sequencer.click({ position: { x: 100, y: 171 } });
    await expect(notes).toHaveCount(1);
  });

  await test.step("入力欄内でCtrlまたはMeta+Zを押してもノートは減らない", async () => {
    const input = page.getByRole("spinbutton", { name: "テンポ" });
    await input.focus();
    await expect(input).toBeFocused();
    await input.press("ControlOrMeta+Z");
    await expect(notes).toHaveCount(1);
    await expect(input).toBeFocused();
  });

  await test.step("入力欄からフォーカスを外すとCtrlまたはMeta+Zで追加を元に戻す", async () => {
    await page.getByRole("button", { name: "ソング", exact: true }).focus();
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(notes).toHaveCount(0);
  });
});

test("テキスト入力中はSpaceで再生しない", async ({ page }) => {
  await navigateToMain(page);

  const input = page.getByRole("textbox", { name: "1行目", exact: true });
  const audioDetail = page.getByTestId("audio-detail");
  const playButton = audioDetail
    .getByRole("button")
    .filter({ hasText: "play_arrow" });
  const stopButton = audioDetail
    .getByRole("button")
    .filter({ hasText: "stop" });

  await test.step("再生できるテキストを入力する", async () => {
    await fillAudioCell(
      page,
      0,
      "あれもこれもそれもどれも、あれもこれもそれもどれも。",
    );
    await expect(input).toBeFocused();
    await expect(playButton).toBeVisible();
  });
  await waitForUiUnlock(page);

  await test.step("入力欄内でSpaceを押すと空白が入り再生しない", async () => {
    await input.press("End");
    await input.press("Space");
    await expect(input).toHaveValue(
      "あれもこれもそれもどれも、あれもこれもそれもどれも。 ",
    );
    await expect(input).toBeFocused();
    await expect(playButton).toBeVisible();
    await expect(stopButton).not.toBeVisible();
  });

  await test.step("入力欄からフォーカスを外すとSpaceで再生できる", async () => {
    await page.locator(".audio-cell").first().focus();
  });
  await waitForUiUnlock(page);

  await test.step("Spaceで再生して停止する", async () => {
    await page.keyboard.press("Space");
    await expect(stopButton).toBeVisible();
    await expect(stopButton).toBeEnabled();
    await expect(audioDetail.locator(".accent-phrase").nth(1)).toHaveClass(
      /accent-phrase-focus/,
    );
    await page.keyboard.press("Space");
    await expect(playButton).toBeVisible();
  });
});

test("ソングの入力欄内ではSpaceで再生しない", async ({ page }) => {
  await navigateToSong(page);

  const sequencer = page.getByLabel("シーケンサ");
  const lyricInput = sequencer.locator(".lyric-input");
  const stopButton = page.getByRole("button").filter({ hasText: "stop" });

  await test.step("テンポの入力欄内でSpaceを押しても再生しない", async () => {
    const tempoInput = page.getByRole("spinbutton", { name: "テンポ" });
    await tempoInput.focus();
    await expect(tempoInput).toBeFocused();
    await tempoInput.press("Space");
    await expect(tempoInput).toHaveValue("120");
    await expect(stopButton).not.toBeVisible();
  });

  await test.step("ノートを追加して歌詞を入力する", async () => {
    await sequencer.click({ position: { x: 100, y: 171 } });
    await expect(sequencer.locator(".note")).toHaveCount(1);
    await sequencer.locator(".note").dblclick();
    await lyricInput.fill("あ");
  });

  await test.step("歌詞の入力欄内でSpaceを押すと空白が入り再生しない", async () => {
    await expect(lyricInput).toBeFocused();
    await lyricInput.press("End");
    await lyricInput.press("Space");
    await expect(lyricInput).toHaveValue("あ ");
    await expect(stopButton).not.toBeVisible();
  });

  await test.step("歌詞の入力を終えるとSpaceで再生できる", async () => {
    await lyricInput.fill("あ");
    await lyricInput.press("Enter");
    await expect(lyricInput).not.toBeVisible();
    await page.keyboard.press("Space");
    await expect(stopButton).toBeVisible();
    await page.keyboard.press("Space");
    await expect(stopButton).not.toBeVisible();
  });
});

test("表示中のエディタのコールバックのみが呼ばれる", async ({ page }) => {
  await navigateToMain(page);

  const audioCells = page.locator(".audio-cell");
  const sequencer = page.getByLabel("シーケンサ");
  const notes = sequencer.locator(".note");

  await test.step("トークにテキスト欄を追加する", async () => {
    await page.getByRole("button", { name: "テキストを追加" }).click();
    await expect(audioCells).toHaveCount(2);
  });
  await waitForUiUnlock(page);

  await test.step("ソングに切り替えてノートを2つ追加する", async () => {
    await page.getByRole("button", { name: "ソング", exact: true }).click();
    await sequencer.click({ position: { x: 100, y: 171 } });
    await expect(notes).toHaveCount(1);
    await sequencer.click({ position: { x: 200, y: 171 } });
    await expect(notes).toHaveCount(2);
  });

  await test.step("ソングだけでノートの追加を元に戻す", async () => {
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(notes).toHaveCount(1);
    await page.getByRole("button", { name: "トーク", exact: true }).click();
    await expect(audioCells).toHaveCount(2);
  });
  await waitForUiUnlock(page);

  await test.step("トークだけでテキスト欄の追加を元に戻す", async () => {
    await audioCells.last().focus();
    await page.keyboard.press("ControlOrMeta+Z");
    await expect(audioCells).toHaveCount(1);
    await page.getByRole("button", { name: "ソング", exact: true }).click();
    await expect(notes).toHaveCount(1);
  });
});

test("キー割り当てを変更すると新しいキーだけでテキスト欄を追加できる", async ({
  page,
}) => {
  await navigateToMain(page);

  const audioCells = page.locator(".audio-cell");

  await changeHotkey(
    page,
    "テキスト欄を追加",
    "Shift + Enter",
    "ControlOrMeta+Shift+Enter",
  );
  await waitForUiUnlock(page);

  await test.step("変更前のShift+Enterではテキスト欄が増えない", async () => {
    const input = page.getByRole("textbox", { name: "1行目", exact: true });
    await input.press("Shift+Enter");
    await expect(audioCells).toHaveCount(1);
  });

  await test.step("変更後のキーではテキスト欄が1つ増える", async () => {
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(audioCells).toHaveCount(2);
    await expect(
      page.getByRole("textbox", { name: "2行目", exact: true }),
    ).toBeFocused();
  });
});

test("再生・停止のキー割り当てを変更すると両エディタで新しいキーだけが動く", async ({
  page,
}) => {
  await navigateToMain(page);

  const audioDetail = page.getByTestId("audio-detail");
  const talkPlayButton = audioDetail
    .getByRole("button")
    .filter({ hasText: "play_arrow" });
  const talkStopButton = audioDetail
    .getByRole("button")
    .filter({ hasText: "stop" });
  const songPlayButton = page
    .getByRole("button")
    .filter({ hasText: "play_arrow" });
  const songStopButton = page.getByRole("button").filter({ hasText: "stop" });
  const sequencer = page.getByLabel("シーケンサ");

  await test.step("トークに再生するテキストを用意する", async () => {
    await fillAudioCell(
      page,
      0,
      "あれもこれもそれもどれも、あれもこれもそれもどれも。",
    );
  });
  await waitForUiUnlock(page);

  await test.step("ソングでノートを追加してトークに戻る", async () => {
    await page.getByRole("button", { name: "ソング", exact: true }).click();
    await sequencer.click({ position: { x: 100, y: 171 } });
    await expect(sequencer.locator(".note")).toHaveCount(1);
    await page.getByRole("button", { name: "トーク", exact: true }).click();
    await expect(talkPlayButton).toBeVisible();
  });
  await waitForUiUnlock(page);

  await changeHotkey(page, "再生/停止", "Space", "ControlOrMeta+Shift+Enter");
  await waitForUiUnlock(page);

  await test.step("トークでは新しいキーで再生する", async () => {
    await page.locator(".audio-cell").first().focus();
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(talkStopButton).toBeVisible();
    await expect(talkStopButton).toBeEnabled();
    await expect(audioDetail.locator(".accent-phrase").nth(1)).toHaveClass(
      /accent-phrase-focus/,
    );
  });

  await test.step("トークでは変更前のSpaceを押しても再生が続く", async () => {
    await page.keyboard.press("Space");
    await expect(audioDetail.locator(".accent-phrase").nth(2)).toHaveClass(
      /accent-phrase-focus/,
    );
    await expect(talkStopButton).toBeVisible();
  });

  await test.step("トークでは新しいキーで停止する", async () => {
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(talkPlayButton).toBeVisible();
    await expect(talkStopButton).not.toBeVisible();
  });
  await waitForUiUnlock(page);

  await test.step("ソングでも新しいキーで再生する", async () => {
    await page.getByRole("button", { name: "ソング", exact: true }).click();
    await sequencer.locator(".note").click();
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(songStopButton).toBeVisible();
    await expect(songStopButton).toBeEnabled();
  });

  await test.step("ソングでも変更前のSpaceを押しても再生が続く", async () => {
    await page.keyboard.press("Space");
    await expect(songStopButton).toBeVisible();
  });

  await test.step("ソングでも新しいキーで停止する", async () => {
    await page.keyboard.press("ControlOrMeta+Shift+Enter");
    await expect(songPlayButton).toBeVisible();
    await expect(songStopButton).not.toBeVisible();
  });
});
