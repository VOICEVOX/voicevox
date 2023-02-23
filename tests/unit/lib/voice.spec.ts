import { voiceIdToVoice, voiceToVoiceId } from "@/lib/voice";
import { EngineId, SpeakerId, StyleId, Voice } from "@/type/preload";
import { describe, expect, it } from "vitest";

describe("voiceIdToVoice, voiceToVoiceId", () => {
  it("VoiceとVoiceIdは互いに変換可能", () => {
    const voice: Voice = {
      engineId: EngineId("57959e44-0c80-4c21-984d-7ba58224e834"),
      speakerId: SpeakerId("acb2b256-ead4-43b4-b738-84c0f0feb36d"),
      styleId: StyleId(0),
    };

    expect(voiceIdToVoice(voiceToVoiceId(voice))).toEqual(voice);
  });
});
