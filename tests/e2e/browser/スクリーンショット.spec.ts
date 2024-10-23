import path from "path";
import fs from "fs/promises";
import { test, expect } from "@playwright/test";
import { gotoHome, navigateToMain } from "../navigators";
import { getEngineManifestMock } from "@/mock/engineMock/manifestMock";
import {
  getSingersMock,
  getSpeakerInfoMock,
  getSpeakersMock,
} from "@/mock/engineMock/characterResourceMock";
import {
  replaceLengthMock,
  replacePitchMock,
  textToActtentPhrasesMock,
} from "@/mock/engineMock/talkModelMock";
import { assetsPath } from "@/mock/engineMock/constants";
import {
  AccentPhraseFromJSON,
  AccentPhraseToJSON,
  AudioQueryFromJSON,
  AudioQueryToJSON,
  BodySingFrameVolumeSingFrameVolumePostFromJSON,
  EngineManifestToJSON,
  FrameAudioQueryFromJSON,
  FrameAudioQueryToJSON,
  ScoreFromJSON,
  SpeakerInfoToJSON,
  SpeakerToJSON,
  SupportedDevicesInfoToJSON,
} from "@/openapi";
import { synthesisFrameAudioQueryMock } from "@/mock/engineMock/synthesisMock";
import { audioQueryToFrameAudioQueryMock } from "@/mock/engineMock/audioQueryMock";
import {
  notesAndFramePhonemesAndPitchToVolumeMock,
  notesAndFramePhonemesToPitchMock,
  notesToFramePhonemesMock,
} from "@/mock/engineMock/singModelMock";

test.beforeEach(async ({ page }) => {
  const speakers = getSpeakersMock();
  const singers = getSingersMock();

  await page.route(/\/version$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify("mock"),
    });
  });

  await page.route(/\/engine_manifest$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(EngineManifestToJSON(getEngineManifestMock())),
    });
  });

  await page.route(/\/supported_devices$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        SupportedDevicesInfoToJSON({ cpu: true, cuda: false, dml: false }),
      ),
    });
  });

  await page.route(new RegExp(`/${assetsPath}/`), async (route) => {
    const filePath = path.join(
      __dirname,
      "..",
      "..",
      "..",
      new URL(route.request().url()).pathname,
    );
    const body = await fs.readFile(filePath);
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "image/png",
      },
      body,
    });
  });

  await page.route(/\/speakers$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(speakers.map(SpeakerToJSON)),
    });
  });

  await page.route(/\/speaker_info\?/, async (route) => {
    const query = new URLSearchParams(route.request().url().split("?")[1]);
    const speakerUuid = query.get("speaker_uuid");
    if (speakerUuid == null) {
      throw new Error("speaker_uuid is required");
    }

    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SpeakerInfoToJSON(getSpeakerInfoMock(speakerUuid))),
    });
  });

  await page.route(/\/singers$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(singers.map(SpeakerToJSON)),
    });
  });

  await page.route(/\/singer_info\?/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const speakerUuid = payload.get("speaker_uuid");
    if (speakerUuid == undefined) {
      throw new Error("speaker_uuid is required");
    }

    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(SpeakerInfoToJSON(getSpeakerInfoMock(speakerUuid))),
    });
  });

  await page.route(/\/is_initialized_speaker/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(true),
    });
  });

  await page.route(/\/initialize_speaker/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
    });
  });

  // NOTE: 空のユーザ辞書を返す
  await page.route(/\/user_dict$/, async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([]),
    });
  });

  await page.route(/\/audio_query/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const text = payload.get("text");
    const speaker = Number(payload.get("speaker"));
    if (text == undefined || speaker == undefined) {
      throw new Error("text, speaker is required");
    }

    const accentPhrases = await textToActtentPhrasesMock(text, speaker);
    return route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        AudioQueryToJSON({
          accentPhrases,
          speedScale: 1.0,
          pitchScale: 0.0,
          intonationScale: 1.0,
          volumeScale: 1.0,
          prePhonemeLength: 0.1,
          postPhonemeLength: 0.1,
          outputSamplingRate: getEngineManifestMock().defaultSamplingRate,
          outputStereo: false,
        }),
      ),
    });
  });

  await page.route(/\/accent_phrases/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const text = payload.get("text");
    const speaker = Number(payload.get("speaker"));
    if (text == undefined || speaker == undefined) {
      throw new Error("text, speaker is required");
    }

    const isKana = payload.get("is_kana") === "true";
    if (isKana) {
      throw new Error("AquesTalk風記法は未対応です");
    }

    const accentPhrases = await textToActtentPhrasesMock(text, speaker);
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accentPhrases.map(AccentPhraseToJSON)),
    });
  });

  await page.route(/\/mora_data/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const speaker = Number(payload.get("speaker"));
    const accentPhraseRaw = route.request().postData();
    if (accentPhraseRaw == undefined || speaker == undefined) {
      throw new Error("accent_phrase, speaker is required");
    }

    const accentPhrase = (JSON.parse(accentPhraseRaw) as []).map(
      AccentPhraseFromJSON,
    );
    replaceLengthMock(accentPhrase, speaker);
    replacePitchMock(accentPhrase, speaker);
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(accentPhrase.map(AccentPhraseToJSON)),
    });
  });

  await page.route(/\/synthesis/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const speaker = Number(payload.get("speaker"));
    const enableInterrogativeUpspeak =
      payload.get("enable_interrogative_upspeak") === "true";
    const audioQueryRaw = route.request().postData();
    if (audioQueryRaw == undefined || speaker == undefined) {
      throw new Error("audio_query, speaker is required");
    }

    const audioQuery = AudioQueryFromJSON(JSON.parse(audioQueryRaw));
    const frameAudioQuery = audioQueryToFrameAudioQueryMock(audioQuery, {
      enableInterrogativeUpspeak,
    });
    const buffer = synthesisFrameAudioQueryMock(frameAudioQuery, speaker);
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "audio/wav",
      },
      body: Buffer.from(buffer),
    });
  });

  await page.route(/\/sing_frame_audio_query/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const speaker = Number(payload.get("speaker"));
    const scoreRaw = route.request().postData();
    if (scoreRaw == undefined || speaker == undefined) {
      throw new Error("score, speaker is required");
    }

    const score = ScoreFromJSON(JSON.parse(scoreRaw));
    const phonemes = notesToFramePhonemesMock(score.notes, speaker);
    const f0 = notesAndFramePhonemesToPitchMock(score.notes, phonemes, speaker);
    const volume = notesAndFramePhonemesAndPitchToVolumeMock(
      score.notes,
      phonemes,
      f0,
      speaker,
    );

    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        FrameAudioQueryToJSON({
          f0,
          volume,
          phonemes,
          volumeScale: 1.0,
          outputSamplingRate: getEngineManifestMock().defaultSamplingRate,
          outputStereo: false,
        }),
      ),
    });
  });

  await page.route(/\/sing_frame_volume/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const speaker = Number(payload.get("speaker"));
    const raw = route.request().postData();
    if (raw == undefined || speaker == undefined) {
      throw new Error("score, speaker is required");
    }

    const { score, frameAudioQuery } =
      BodySingFrameVolumeSingFrameVolumePostFromJSON(JSON.parse(raw));
    const volume = notesAndFramePhonemesAndPitchToVolumeMock(
      score.notes,
      frameAudioQuery.phonemes,
      frameAudioQuery.f0,
      speaker,
    );

    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(volume),
    });
  });

  await page.route(/\/frame_synthesis/, async (route) => {
    const payload = new URLSearchParams(new URL(route.request().url()).search);
    const speaker = Number(payload.get("speaker"));
    const frameAudioQueryRaw = route.request().postData();
    if (frameAudioQueryRaw == undefined || speaker == undefined) {
      throw new Error("frame_audio_query, speaker is required");
    }

    const frameAudioQuery = FrameAudioQueryFromJSON(
      JSON.parse(frameAudioQueryRaw),
    );
    const buffer = synthesisFrameAudioQueryMock(frameAudioQuery, speaker);
    await route.fulfill({
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "audio/wav",
      },
      body: Buffer.from(buffer),
    });
  });
});
test.beforeEach(gotoHome);

test("メイン画面の表示", async ({ page }) => {
  test.skip(process.platform !== "win32", "Windows以外のためスキップします");
  await navigateToMain(page);

  // トーク画面の表示
  while (true) {
    await page.locator(".audio-cell:nth-child(1) .q-field").click(); // 一番上のテキスト欄をクリックする
    await page.waitForTimeout(100);
    // ローディングが消えるまで待つ
    if (
      (await page
        .locator(".character-portrait-wrapper .character-name")
        .innerText()) !== "（表示エラー）" &&
      (await page.locator(".character-portrait-wrapper .loading").count()) === 0
    ) {
      break;
    }
  }
  // 永久に待機
  await page.waitForTimeout(1000000);
  await expect(page).toHaveScreenshot("トーク画面.png");

  // ソング画面の表示
  await page.getByText("ソング").click();
  await expect(page.getByText("ソング")).toBeEnabled(); // 無効化が解除されるまで待つ
  await expect(page).toHaveScreenshot("ソング画面.png");
});
