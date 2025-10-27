import { ProjectFileTrack } from "./type";
import { Track } from "@/domain/project/type";
import { mapToRecord, recordToMap } from "@/sing/utility";

export function toProjectFileTrack(track: Track): ProjectFileTrack {
  return {
    name: track.name,
    singer: track.singer,
    keyRangeAdjustment: track.keyRangeAdjustment,
    volumeRangeAdjustment: track.volumeRangeAdjustment,
    notes: track.notes,
    pitchEditData: track.pitchEditData,
    volumeEditData: track.volumeEditData,
    phonemeTimingEditData: mapToRecord(track.phonemeTimingEditData),
    solo: track.solo,
    mute: track.mute,
    gain: track.gain,
    pan: track.pan,
  };
}

export function toEditorTrack(projectFileTrack: ProjectFileTrack): Track {
  return {
    name: projectFileTrack.name,
    singer: projectFileTrack.singer,
    keyRangeAdjustment: projectFileTrack.keyRangeAdjustment,
    volumeRangeAdjustment: projectFileTrack.volumeRangeAdjustment,
    notes: projectFileTrack.notes,
    pitchEditData: projectFileTrack.pitchEditData,
    volumeEditData: projectFileTrack.volumeEditData,
    phonemeTimingEditData: recordToMap(projectFileTrack.phonemeTimingEditData),
    solo: projectFileTrack.solo,
    mute: projectFileTrack.mute,
    gain: projectFileTrack.gain,
    pan: projectFileTrack.pan,
  };
}
