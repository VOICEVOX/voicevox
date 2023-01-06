import {
  Score,
  Tempo,
  TimeSignature,
  Note,
  SingingStoreState,
  SingingStoreTypes,
} from "./type";
import { createPartialStore } from "./vuex";
import { createUILockAction } from "./ui";
import { Midi } from "@tonejs/midi";

export const singingStoreState: SingingStoreState = {
  engineId: undefined,
  styleId: undefined,
  score: {
    resolution: 480,
    tempos: [
      {
        position: 0,
        tempo: 120,
      },
    ],
    timeSignatures: [
      {
        position: 0,
        beats: 4,
        beatType: 4,
      },
    ],
    notes: [],
  },
  renderPhrases: [],
  // NOTE: UIの状態は試行のためsinging.tsに局所化する+Hydrateが必要
  isShowSinger: true,
  sequencerZoomX: 1,
  sequencerZoomY: 1,
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
      if (score.tempos.length !== 1 || score.tempos[0].position !== 0) {
        throw new Error("Tempo does not exist at the beginning of the score.");
      }
      if (
        score.timeSignatures.length !== 1 ||
        score.timeSignatures[0].position !== 0
      ) {
        throw new Error(
          "Time signature does not exist at the beginning of the score."
        );
      }
      return score;
    },
  },

  SET_SCORE: {
    mutation(state, { score }: { score: Score }) {
      state.score = score;
    },
    async action({ commit }, { score }: { score: Score }) {
      console.log(score);
      commit("SET_SCORE", { score });
    },
  },

  SET_TEMPO: {
    mutation(state, { index, tempo }: { index: number; tempo: Tempo }) {
      state.score?.tempos.splice(index, 0, tempo);
    },
    // テンポを設定する。既に同じ位置にテンポが存在する場合は置き換える。
    async action({ state, commit }, { tempo }: { tempo: Tempo }) {
      const score = state.score;
      if (score === undefined || score.tempos.length === 0) {
        throw new Error("Score is not initialized.");
      }
      if (
        Number.isNaN(tempo.position) ||
        tempo.position < 0 ||
        Number.isNaN(tempo.tempo) ||
        tempo.tempo <= 0
      ) {
        throw new Error("The value is invalid.");
      }
      const duplicate = score.tempos.some((value) => {
        return value.position === tempo.position;
      });
      const index = score.tempos.findIndex((value) => {
        return value.position >= tempo.position;
      });
      if (index === -1) return;

      const round = (value: number, digits: number) => {
        const powerOf10 = 10 ** digits;
        return Math.round(value * powerOf10) / powerOf10;
      };

      tempo.tempo = round(tempo.tempo, 2);

      if (duplicate) {
        commit("REMOVE_TEMPO", { index });
      }
      commit("SET_TEMPO", { index, tempo });
    },
  },

  REMOVE_TEMPO: {
    mutation(state, { index }: { index: number }) {
      state.score?.tempos.splice(index, 1);
    },
    // テンポを削除する。先頭のテンポの場合はデフォルトのテンポに置き換える。
    async action(
      { state, commit, dispatch },
      { position }: { position: number }
    ) {
      const emptyScore = await dispatch("GET_EMPTY_SCORE");
      const defaultTempo = emptyScore.tempos[0];

      const score = state.score;
      if (score === undefined || score.tempos.length === 0) {
        throw new Error("Score is not initialized.");
      }
      const index = score.tempos.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) return;

      commit("REMOVE_TEMPO", { index });
      if (score.tempos.length === 0) {
        commit("SET_TEMPO", { index, tempo: defaultTempo });
      }
    },
  },

  SET_TIME_SIGNATURE: {
    mutation(
      state,
      { index, timeSignature }: { index: number; timeSignature: TimeSignature }
    ) {
      state.score?.timeSignatures.splice(index, 0, timeSignature);
    },
    // 拍子を設定する。既に同じ位置に拍子が存在する場合は置き換える。
    async action(
      { state, commit },
      { timeSignature }: { timeSignature: TimeSignature }
    ) {
      const score = state.score;
      if (score === undefined || score.timeSignatures.length === 0) {
        throw new Error("Score is not initialized.");
      }
      if (
        Number.isNaN(timeSignature.position) ||
        timeSignature.position < 0 ||
        !Number.isInteger(timeSignature.beats) ||
        !Number.isInteger(timeSignature.beatType) ||
        timeSignature.beats <= 0 ||
        timeSignature.beatType <= 0
      ) {
        throw new Error("The value is invalid.");
      }
      const duplicate = score.timeSignatures.some((value) => {
        return value.position === timeSignature.position;
      });
      const index = score.timeSignatures.findIndex((value) => {
        return value.position >= timeSignature.position;
      });
      if (index === -1) return;

      if (duplicate) {
        commit("REMOVE_TIME_SIGNATURE", { index });
      }
      commit("SET_TIME_SIGNATURE", { index, timeSignature });
    },
  },

  REMOVE_TIME_SIGNATURE: {
    mutation(state, { index }: { index: number }) {
      state.score?.timeSignatures.splice(index, 1);
    },
    // 拍子を削除する。先頭の拍子の場合はデフォルトの拍子に置き換える。
    async action(
      { state, commit, dispatch },
      { position }: { position: number }
    ) {
      const emptyScore = await dispatch("GET_EMPTY_SCORE");
      const defaultTimeSignature = emptyScore.timeSignatures[0];

      const score = state.score;
      if (score === undefined || score.timeSignatures.length === 0) {
        throw new Error("Score is not initialized.");
      }
      const index = score.timeSignatures.findIndex((value) => {
        return value.position === position;
      });
      if (index === -1) return;

      commit("REMOVE_TIME_SIGNATURE", { index });
      if (score.timeSignatures.length === 0) {
        commit("SET_TIME_SIGNATURE", {
          index,
          timeSignature: defaultTimeSignature,
        });
      }
    },
  },

  ADD_NOTE: {
    mutation(state, { note }: { note: Note }) {
      if (state.score) {
        const notes = [...state.score.notes].concat(note).sort((a, b) => {
          return a.position < b.position ? -1 : 1;
        });
        state.score.notes = notes;
      }
    },
    // ノートを追加する
    // NOTE: 重複削除など別途追加
    async action({ state, commit }, { note }: { note: Note }) {
      if (state.score === undefined) {
        throw new Error("Score is not initialized.");
      }
      commit("ADD_NOTE", { note });
    },
  },

  CHANGE_NOTE: {
    mutation(state, { index, note }: { index: number; note: Note }) {
      state.score?.notes.splice(index, 1, note);
    },
    async action(
      { state, commit },
      { index, note }: { index: number; note: Note }
    ) {
      if (state.score === undefined) {
        throw new Error("Score is not initialized.");
      }
      commit("CHANGE_NOTE", { index, note });
    },
  },

  REMOVE_NOTE: {
    mutation(state, { index }: { index: number }) {
      state.score?.notes.splice(index, 1);
    },
    async action({ state, commit }, { index }: { index: number }) {
      if (state.score === undefined) {
        throw new Error("Score is not initialized.");
      }
      commit("REMOVE_NOTE", { index });
    },
  },

  SET_ZOOM_X: {
    mutation(state, { zoomX }: { zoomX: number }) {
      state.sequencerZoomX = zoomX;
    },
    async action({ commit }, { zoomX }) {
      commit("SET_ZOOM_X", {
        zoomX,
      });
    },
  },

  SET_ZOOM_Y: {
    mutation(state, { zoomY }: { zoomY: number }) {
      state.sequencerZoomY = zoomY;
    },
    async action({ commit }, { zoomY }) {
      commit("SET_ZOOM_Y", {
        zoomY,
      });
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

        const round = (value: number, digits: number) => {
          const powerOf10 = 10 ** digits;
          return Math.round(value * powerOf10) / powerOf10;
        };

        // TODO: UIで読み込むトラックを選択できるようにする
        // ひとまず1トラック目のみを読み込む
        midi.tracks[0].notes
          .map((note) => ({
            position: convertToPosBasedOnRes(note.ticks),
            duration: convertToDurationBasedOnRes(
              note.ticks,
              note.durationTicks
            ),
            midi: note.midi,
            lyric: "",
          }))
          .sort((a, b) => a.position - b.position)
          .forEach((note) => {
            // ノートの重なりを考慮して、一番音が高いノート（トップノート）のみインポートする
            if (score.notes.length === 0) {
              score.notes.push(note);
              return;
            }
            const topNote = score.notes[score.notes.length - 1];
            const topNoteEnd = topNote.position + topNote.duration;
            if (note.position >= topNoteEnd) {
              score.notes.push(note);
              return;
            }
            if (note.midi > topNote.midi) {
              score.notes.pop();
              score.notes.push(note);
            }
          });

        const tempos = midi.header.tempos
          .map((tempo) => ({
            position: convertToPosBasedOnRes(tempo.ticks),
            tempo: round(tempo.bpm, 2),
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

        const getMeasureDuration = (beats: number, beatType: number) => {
          const referenceMeasureDuration = score.resolution * 4;
          return Math.round((referenceMeasureDuration * beats) / beatType);
        };

        let divisions = 1;
        let position = 0;
        let measurePosition = 0;
        let measureDuration = getMeasureDuration(
          score.timeSignatures[0].beats,
          score.timeSignatures[0].beatType
        );
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

        const round = (value: number, digits: number) => {
          const powerOf10 = 10 ** digits;
          return Math.round(value * powerOf10) / powerOf10;
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

        const getTie = (elementThatMayBeTied: Element) => {
          let tie = false;
          for (const childElement of elementThatMayBeTied.children) {
            if (
              childElement.tagName === "tie" ||
              childElement.tagName === "tied"
            ) {
              const tieType = childElement.getAttribute("type");
              if (tieType === "start") {
                tie = true;
              } else if (tieType === "stop") {
                tie = false;
              } else {
                throw new Error("The value is invalid.");
              }
            }
          }
          return tie;
        };

        const parseSound = (soundElement: Element) => {
          if (!soundElement.hasAttribute("tempo")) return;
          if (score.tempos.length !== 0) {
            const lastTempo = score.tempos[score.tempos.length - 1];
            if (lastTempo.position === position) {
              score.tempos.pop();
            }
          }
          const tempo = getAttributeAsNumber(soundElement, "tempo");
          score.tempos.push({
            position: position,
            tempo: round(tempo, 2),
          });
        };

        const parseDirection = (directionElement: Element) => {
          for (const childElement of directionElement.children) {
            if (childElement.tagName === "sound") {
              parseSound(childElement);
            }
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
          measureDuration = getMeasureDuration(beats, beatType);
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
          // TODO: ノートの重なり・和音を考慮していないので、
          //       それらが存在する場合でも読み込めるようにする

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

          let tie = getTie(noteElement);
          for (const childElement of noteElement.children) {
            if (childElement.tagName === "notations") {
              tie = getTie(childElement);
            }
          }

          const note = {
            position: position,
            duration: duration,
            midi: noteNumber,
            lyric: lyric,
          };

          if (tie) {
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
