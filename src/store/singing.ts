import { Note, Score, SingingStoreState, SingingStoreTypes } from "./type";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import { Midi } from "@tonejs/midi";

export const singingStoreState: SingingStoreState = {
  engineId: undefined,
  styleId: undefined,
  score: undefined,
  renderPhrases: [],
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
  isShowSinger: true,
};

export const singingStore = createPartialStore<SingingStoreTypes>({
  SET_SHOW_SINGER: {
    mutation(state, { isShowSinger }: { isShowSinger: boolean }) {
      state.isShowSinger = isShowSinger;
    },
    async action({ commit }, { isShowSinger }) {
      commit("SET_SHOW_SINGER", {
        isShowSinger,
      });
    },
  },

  SET_SINGER: {
    mutation(
      state,
      { engineId, styleId }: { engineId: string; styleId: number }
    ) {
      state.engineId = engineId;
      state.styleId = styleId;
    },
    async action(
      { state, getters, dispatch, commit },
      payload: { engineId?: string; styleId?: number }
    ) {
      if (state.defaultStyleIds == undefined)
        throw new Error("state.defaultStyleIds == undefined");
      if (getters.USER_ORDERED_CHARACTER_INFOS == undefined)
        throw new Error("state.characterInfos == undefined");
      const userOrderedCharacterInfos = getters.USER_ORDERED_CHARACTER_INFOS;

      const engineId = payload.engineId ?? state.engineIds[0];

      // FIXME: engineIdも含めて探査する
      const styleId =
        payload.styleId ??
        state.defaultStyleIds[
          state.defaultStyleIds.findIndex(
            (x) =>
              x.speakerUuid === userOrderedCharacterInfos[0].metas.speakerUuid // FIXME: defaultStyleIds内にspeakerUuidがない場合がある
          )
        ].defaultStyleId;

      try {
        // 指定されたstyleIdに対して、エンジン側の初期化を行う
        const isInitialized = await dispatch("IS_INITIALIZED_ENGINE_SPEAKER", {
          engineId,
          styleId,
        });
        if (!isInitialized) {
          await dispatch("INITIALIZE_ENGINE_SPEAKER", {
            engineId,
            styleId,
          });
        }
      } finally {
        commit("SET_SINGER", { engineId, styleId });
      }
    },
  },

  GET_EMPTY_SCORE: {
    async action() {
      const score: Score = {
        resolution: 480,
        tempos: [{ position: 0, tempo: 120 }],
        timeSignatures: [{ position: 0, beats: 4, beatType: 4 }],
        notes: [],
      };
      return score;
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      state.score = score;
    },
    async action({ commit }, { score }: { score: Score }) {
      commit("SET_SCORE", { score });
    },
  },

  IMPORT_MIDI_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "MIDI読み込み",
            name: "MIDI",
            extensions: ["mid", "midi"],
          });
          if (!filePath) return;
        }

        const midiData = await window.electron.readFile({ filePath });
        const midi = new Midi(midiData);

        const score = await dispatch("GET_EMPTY_SCORE");

        const convertToPosBasedOnRes = (position: number) => {
          return Math.round(position * (score.resolution / midi.header.ppq));
        };

        const convertToDurationBasedOnRes = (
          position: number,
          duration: number
        ) => {
          let endPosition = position + duration;
          endPosition = convertToPosBasedOnRes(endPosition);
          position = convertToPosBasedOnRes(position);
          return Math.max(0, endPosition - position);
        };

        midi.tracks
          .map((track, index) => {
            // TODO: UIで読み込むトラックを選択できるようにする
            if (index !== 0) return []; // ひとまず1トラック目のみを読み込む
            return track.notes.map((note) => ({
              position: convertToPosBasedOnRes(note.ticks),
              duration: convertToDurationBasedOnRes(
                note.ticks,
                note.durationTicks
              ),
              midi: note.midi,
              lyric: "",
            }));
          })
          .flat()
          .sort((a, b) => a.position - b.position)
          .forEach((note) => {
            if (score.notes.length === 0) {
              score.notes.push(note);
              return;
            }
            const lastNote = score.notes[score.notes.length - 1];
            const lastNoteEnd = lastNote.position + lastNote.duration;
            if (note.position >= lastNoteEnd) {
              score.notes.push(note);
            }
          });

        const tempos = midi.header.tempos
          .map((tempo) => ({
            position: convertToPosBasedOnRes(tempo.ticks),
            tempo: tempo.bpm,
          }))
          .sort((a, b) => a.position - b.position);

        score.tempos = score.tempos
          .concat(tempos)
          .filter((value, index, array) => {
            if (index === array.length - 1) return true;
            return value.position !== array[index + 1].position;
          });

        const timeSignatures = midi.header.timeSignatures
          .map((timeSignature) => ({
            position: convertToPosBasedOnRes(timeSignature.ticks),
            beats: timeSignature.timeSignature[0],
            beatType: timeSignature.timeSignature[1],
          }))
          .sort((a, b) => a.position - b.position);

        score.timeSignatures = score.timeSignatures
          .concat(timeSignatures)
          .filter((value, index, array) => {
            if (index === array.length - 1) return true;
            return value.position !== array[index + 1].position;
          });

        await dispatch("SET_SCORE", { score });
      }
    ),
  },

  IMPORT_MUSICXML_FILE: {
    action: createUILockAction(
      async ({ dispatch }, { filePath }: { filePath?: string }) => {
        if (!filePath) {
          filePath = await window.electron.showImportFileDialog({
            title: "MusicXML読み込み",
            name: "MusicXML",
            extensions: ["musicxml", "xml"],
          });
          if (!filePath) return;
        }

        let xmlStr = new TextDecoder("utf-8").decode(
          await window.electron.readFile({ filePath })
        );
        if (xmlStr.indexOf("\ufffd") > -1) {
          xmlStr = new TextDecoder("shift-jis").decode(
            await window.electron.readFile({ filePath })
          );
        }

        const score = await dispatch("GET_EMPTY_SCORE");

        const getDurationOfFirstMeasure = (score: Score) => {
          const beats = score.timeSignatures[0].beats;
          const beatType = score.timeSignatures[0].beatType;
          return (score.resolution * 4 * beats) / beatType;
        };

        let divisions = 1;
        let position = 0;
        let measurePosition = 0;
        let measureDuration = getDurationOfFirstMeasure(score);
        let tieStartNote: Note | null = null;

        const getChild = (element: Element | null, tagName: string) => {
          if (element === null) return null;
          for (const childElement of element.children) {
            if (childElement.tagName === tagName) {
              return childElement;
            }
          }
          return null;
        };

        const getValueAsNumber = (element: Element) => {
          const value = Number(element.textContent);
          if (Number.isNaN(value)) {
            throw new Error("The value is invalid.");
          }
          return value;
        };

        const getAttributeAsNumber = (
          element: Element,
          qualifiedName: string
        ) => {
          const value = Number(element.getAttribute(qualifiedName));
          if (Number.isNaN(value)) {
            throw new Error("The value is invalid.");
          }
          return value;
        };

        const getStepNumber = (stepElement: Element) => {
          const stepNumberDict: { [key: string]: number } = {
            C: 0,
            D: 2,
            E: 4,
            F: 5,
            G: 7,
            A: 9,
            B: 11,
          };
          const stepChar = stepElement.textContent;
          if (stepChar === null) {
            throw new Error("The value is invalid.");
          }
          return stepNumberDict[stepChar];
        };

        const getDuration = (durationElement: Element) => {
          const duration = getValueAsNumber(durationElement);
          return Math.round((score.resolution * duration) / divisions);
        };

        const parseSound = (soundElement: Element) => {
          if (!soundElement.hasAttribute("tempo")) return;
          if (score.tempos.length !== 0) {
            const lastTempo = score.tempos[score.tempos.length - 1];
            if (lastTempo.position === position) {
              score.tempos.pop();
            }
          }
          score.tempos.push({
            position: position,
            tempo: getAttributeAsNumber(soundElement, "tempo"),
          });
        };

        const parseDirection = (directionElement: Element) => {
          const soundElements = directionElement.getElementsByTagName("sound");
          for (const soundElement of soundElements) {
            parseSound(soundElement);
          }
        };

        const parseDivisions = (divisionsElement: Element) => {
          divisions = getValueAsNumber(divisionsElement);
        };

        const parseTime = (timeElement: Element) => {
          const beatsElement = getChild(timeElement, "beats");
          if (beatsElement === null) {
            throw new Error("beats element does not exist.");
          }
          const beatTypeElement = getChild(timeElement, "beat-type");
          if (beatTypeElement === null) {
            throw new Error("beat-type element does not exist.");
          }
          const beats = getValueAsNumber(beatsElement);
          const beatType = getValueAsNumber(beatTypeElement);
          measureDuration = Math.round(
            (score.resolution * 4 * beats) / beatType
          );
          if (score.timeSignatures.length !== 0) {
            const lastTimeSignature =
              score.timeSignatures[score.timeSignatures.length - 1];
            if (lastTimeSignature.position === position) {
              score.timeSignatures.pop();
            }
          }
          score.timeSignatures.push({
            position: position,
            beats: beats,
            beatType: beatType,
          });
        };

        const parseAttributes = (attributesElement: Element) => {
          for (const childElement of attributesElement.children) {
            if (childElement.tagName === "divisions") {
              parseDivisions(childElement);
            } else if (childElement.tagName === "time") {
              parseTime(childElement);
            } else if (childElement.tagName === "sound") {
              parseSound(childElement);
            }
          }
        };

        const parseNote = (noteElement: Element) => {
          const durationElement = getChild(noteElement, "duration");
          if (durationElement === null) {
            throw new Error("duration element does not exist.");
          }
          let duration = getDuration(durationElement);
          let noteEnd = position + duration;
          const measureEnd = measurePosition + measureDuration;
          if (noteEnd > measureEnd) {
            // 小節に収まらない場合、ノートの長さを変えて小節に収まるようにする
            duration = measureEnd - position;
            noteEnd = position + duration;
          }

          if (getChild(noteElement, "rest") !== null) {
            position += duration;
            return;
          }

          const pitchElement = getChild(noteElement, "pitch");
          if (pitchElement === null) {
            throw new Error("pitch element does not exist.");
          }
          const octaveElement = getChild(pitchElement, "octave");
          if (octaveElement === null) {
            throw new Error("octave element does not exist.");
          }
          const stepElement = getChild(pitchElement, "step");
          if (stepElement === null) {
            throw new Error("step element does not exist.");
          }
          const alterElement = getChild(pitchElement, "alter");

          const octave = getValueAsNumber(octaveElement);
          const stepNumber = getStepNumber(stepElement);
          let noteNumber = 12 * (octave + 1) + stepNumber;
          if (alterElement !== null) {
            noteNumber += getValueAsNumber(alterElement);
          }

          const lyricElement = getChild(noteElement, "lyric");
          const lyric = getChild(lyricElement, "text")?.textContent ?? "";

          const tieElements = noteElement.getElementsByTagName("tie");
          let tieStart = false;
          for (const tie of tieElements) {
            const tieType = tie.getAttribute("type");
            tieStart ||= tieType === "start";
          }

          const note = {
            position: position,
            duration: duration,
            midi: noteNumber,
            lyric: lyric,
          };

          if (tieStart) {
            if (tieStartNote === null) {
              tieStartNote = note;
            }
          } else {
            if (tieStartNote === null) {
              score.notes.push(note);
            } else {
              tieStartNote.duration = noteEnd - tieStartNote.position;
              score.notes.push(tieStartNote);
              tieStartNote = null;
            }
          }
          position += duration;
        };

        const parseMeasure = (measureElement: Element) => {
          measurePosition = position;
          for (const childElement of measureElement.children) {
            if (childElement.tagName === "direction") {
              parseDirection(childElement);
            } else if (childElement.tagName === "sound") {
              parseSound(childElement);
            } else if (childElement.tagName === "attributes") {
              parseAttributes(childElement);
            } else if (childElement.tagName === "note") {
              if (position < measurePosition + measureDuration) {
                parseNote(childElement);
              }
            }
          }
          const measureEnd = measurePosition + measureDuration;
          if (position !== measureEnd) {
            tieStartNote = null;
            position = measureEnd;
          }
        };

        const parsePart = (partElement: Element) => {
          for (const childElement of partElement.children) {
            if (childElement.tagName === "measure") {
              parseMeasure(childElement);
            }
          }
        };

        const parseMusicXml = (xmlStr: string) => {
          const parser = new DOMParser();
          const dom = parser.parseFromString(xmlStr, "application/xml");
          const partElements = dom.getElementsByTagName("part");
          if (partElements.length === 0) {
            throw new Error("part element does not exist.");
          }
          // TODO: UIで読み込むパートを選択できるようにする
          parsePart(partElements[0]);
        };

        parseMusicXml(xmlStr);

        await dispatch("SET_SCORE", { score });
      }
    ),
  },
});
