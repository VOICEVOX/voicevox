import { describe, expect, test } from "vitest";
import { parseTextFile } from "@/store/audio";
import {
  EngineId,
  SpeakerId,
  StyleId,
  type CharacterInfo,
} from "@/type/preload";

describe("parseTextFile", () => {
  const engineId = EngineId("engine");
  const speakerId = SpeakerId("speaker");
  const defaultVoice = { engineId, speakerId, styleId: StyleId(0) };
  const initVoice = { ...defaultVoice, styleId: StyleId(2) };
  const defaultStyleIds = [
    { engineId, speakerUuid: speakerId, defaultStyleId: StyleId(0) },
  ];
  const characterInfo = (speakerName: string): CharacterInfo => ({
    portraitPath: "portrait",
    metas: {
      speakerUuid: speakerId,
      speakerName,
      policy: "policy",
      styles: [
        {
          engineId,
          styleId: StyleId(1),
          styleName: "Style1",
          iconPath: "icon",
          portraitPath: "portrait",
          voiceSamplePaths: [],
        },
      ],
    },
  });

  test.each([
    ["Voice123", "Voice123"],
    ["Voice123", "vOICE123"],
    ["Voice123", "Ｖｏｉｃｅ１２３"],
    ["Ｖｏｉｃｅ１２３", "voice123"],
    ["ずんだモン", "ずんだﾓﾝ"],
    ["ガウ", "ｶﾞｳ"],
  ])("名前 %s と %s が一致する", (registeredName, inputName) => {
    expect(
      parseTextFile(
        `${inputName},本文ＡＢＣ①`,
        defaultStyleIds,
        [characterInfo(registeredName)],
        initVoice,
      ),
    ).toEqual([{ text: "本文ＡＢＣ①", voice: defaultVoice }]);
  });

  test.each([
    "Voice123（Style1）",
    "voice123(style1)",
    "ＶＯＩＣＥ１２３（ＳＴＹＬＥ１）",
  ])("スタイル付きの名前 %s が一致する", (inputName) => {
    expect(
      parseTextFile(
        `${inputName},本文`,
        defaultStyleIds,
        [characterInfo("Voice123")],
        initVoice,
      ),
    ).toEqual([
      { text: "本文", voice: { ...defaultVoice, styleId: StyleId(1) } },
    ]);
  });

  test.each([
    ["Voice123", "ＶＯＩＣＥ１２４"],
    ["Voice1", "Voice①"],
    ["VoiceIV", "VoiceⅣ"],
  ])(
    "名前 %s と %s は一致せず本文として保持する",
    (registeredName, inputName) => {
      expect(
        parseTextFile(
          `${inputName},本文`,
          defaultStyleIds,
          [characterInfo(registeredName)],
          initVoice,
        ),
      ).toEqual([
        { text: inputName, voice: initVoice },
        { text: "本文", voice: initVoice },
      ]);
    },
  );
});
