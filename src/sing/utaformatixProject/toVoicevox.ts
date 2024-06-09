import { Project as UfProject } from "@sevenc-nanashi/utaformatix-ts";
import { VoicevoxScore } from "./common";
import { DEFAULT_TPQN, createDefaultTrack } from "@/sing/domain";
import { getDoremiFromNoteNumber } from "@/sing/viewHelper";
import { NoteId } from "@/type/preload";
import { Note, Tempo, TimeSignature, Track } from "@/store/type";

/** UtaformatixのプロジェクトをVoicevoxの楽譜データに変換する */
export const ufProjectToVoicevox = (project: UfProject): VoicevoxScore => {
  const convertPosition = (
    position: number,
    sourceTpqn: number,
    targetTpqn: number,
  ) => {
    return Math.round(position * (targetTpqn / sourceTpqn));
  };

  const convertDuration = (
    startPosition: number,
    endPosition: number,
    sourceTpqn: number,
    targetTpqn: number,
  ) => {
    const convertedEndPosition = convertPosition(
      endPosition,
      sourceTpqn,
      targetTpqn,
    );
    const convertedStartPosition = convertPosition(
      startPosition,
      sourceTpqn,
      targetTpqn,
    );
    return Math.max(1, convertedEndPosition - convertedStartPosition);
  };

  const removeDuplicateTempos = (tempos: Tempo[]) => {
    return tempos.filter((value, index, array) => {
      return (
        index === array.length - 1 ||
        value.position !== array[index + 1].position
      );
    });
  };

  const removeDuplicateTimeSignatures = (timeSignatures: TimeSignature[]) => {
    return timeSignatures.filter((value, index, array) => {
      return (
        index === array.length - 1 ||
        value.measureNumber !== array[index + 1].measureNumber
      );
    });
  };

  // 歌詞をひらがなの単独音に変換する
  const convertedProject = project.convertJapaneseLyrics("auto", "KanaCv", {
    convertVowelConnections: true,
  });

  // 480は固定値。
  // https://github.com/sdercolin/utaformatix-data?tab=readme-ov-file#value-conventions
  const projectTpqn = 480;
  const projectTempos = convertedProject.tempos;
  const projectTimeSignatures = convertedProject.timeSignatures;

  const tpqn = DEFAULT_TPQN;

  const tracks: Track[] = convertedProject.tracks.map((projectTrack) => {
    const trackNotes = projectTrack.notes;

    trackNotes.sort((a, b) => a.tickOn - b.tickOn);

    const notes = trackNotes.map((value): Note => {
      return {
        id: NoteId(crypto.randomUUID()),
        position: convertPosition(value.tickOn, projectTpqn, tpqn),
        duration: convertDuration(
          value.tickOn,
          value.tickOff,
          projectTpqn,
          tpqn,
        ),
        noteNumber: value.key,
        lyric: value.lyric || getDoremiFromNoteNumber(value.key),
      };
    });

    return {
      ...createDefaultTrack(),
      notes,
    };
  });

  let tempos = projectTempos.map((value): Tempo => {
    return {
      position: convertPosition(value.tickPosition, projectTpqn, tpqn),
      bpm: value.bpm,
    };
  });
  tempos = removeDuplicateTempos(tempos);

  let timeSignatures: TimeSignature[] = [];
  for (const ts of projectTimeSignatures) {
    const beats = ts.numerator;
    const beatType = ts.denominator;
    timeSignatures.push({
      // UtaFormatixは0から始まるので+1する
      measureNumber: ts.measurePosition + 1,
      beats,
      beatType,
    });
  }
  timeSignatures = removeDuplicateTimeSignatures(timeSignatures);

  return {
    tracks,
    tpqn,
    tempos,
    timeSignatures,
  };
};
