import type { LatestProjectType } from "@/infrastructures/projectFile/type";

export const validateTalkProject = (talkProject: LatestProjectType["talk"]) => {
  if (
    !talkProject.audioKeys.every(
      (audioKey) => audioKey in talkProject.audioItems,
    )
  ) {
    throw new Error(
      "Every audioKey in audioKeys should be a key of audioItems",
    );
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) => talkProject.audioItems[audioKey]?.voice != undefined,
    )
  ) {
    throw new Error('Every audioItem should have a "voice" attribute.');
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.engineId != undefined,
    )
  ) {
    throw new Error('Every voice should have a "engineId" attribute.');
  }
  // FIXME: assert engineId is registered
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.speakerId != undefined,
    )
  ) {
    throw new Error('Every voice should have a "speakerId" attribute.');
  }
  if (
    !talkProject.audioKeys.every(
      (audioKey) =>
        talkProject.audioItems[audioKey]?.voice.styleId != undefined,
    )
  ) {
    throw new Error('Every voice should have a "styleId" attribute.');
  }
};
