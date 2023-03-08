import { describe, expect, it } from "vitest";
import { voiceIdToVoice } from "@/lib/voice";
import { EngineId, SpeakerId, StyleId, Voice, VoiceId } from "@/type/preload";

describe("voiceIdToVoice", () => {
  it("VoiceとVoiceIdは互いに変換可能", () => {
    const voice: Voice = {
      engineId: EngineId("57959e44-0c80-4c21-984d-7ba58224e834"),
      speakerId: SpeakerId("acb2b256-ead4-43b4-b738-84c0f0feb36d"),
      styleId: StyleId(0),
    };

    expect(voiceIdToVoice(VoiceId(voice))).toEqual(voice);
  });

  it("VoiceIdを再変換しても文字列表現は変わらない", () => {
    const voice: Voice = {
      engineId: EngineId("57959e44-0c80-4c21-984d-7ba58224e834"),
      speakerId: SpeakerId("acb2b256-ead4-43b4-b738-84c0f0feb36d"),
      styleId: StyleId(0),
    };
    const voiceId = VoiceId(voice);
    const voice2 = voiceIdToVoice(voiceId);
    const voiceId2 = VoiceId(voice2);

    expect(voiceId2).toEqual(voiceId);
  });
});
