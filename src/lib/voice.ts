import { EngineId, SpeakerId, StyleId, Voice, VoiceId } from "@/type/preload";

export const voiceToVoiceId = (voice: Voice): VoiceId =>
  VoiceId(`${voice.engineId}:${voice.speakerId}:${voice.styleId}`);

export const voiceIdToVoice = (voiceId: VoiceId): Voice => {
  const [engineId, speakerId, styleId] = voiceId.split(":");
  return {
    engineId: EngineId(engineId),
    speakerId: SpeakerId(speakerId),
    styleId: StyleId(Number(styleId)),
  };
};
