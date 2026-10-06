import { describe, expect, it } from "vitest";
import { NoteId } from "@/type/preload";
import { PhraseKey } from "@/store/type";
import type { PhonemeTimingInfo } from "@/song/phonemeTimingEditorStateMachine/common";
import {
  buildPhonemeBoundaryDisplays,
  buildNotePhonemeBands,
} from "@/song/phonemeTimingDisplay";

const a = NoteId("a");
const b = NoteId("b");
const phraseKey = PhraseKey("phrase");
const frameRate = 100;

const createInfo = (
  noteId: NoteId | undefined,
  phoneme: string,
  index: number,
  start: number,
  end: number,
): PhonemeTimingInfo => ({
  phraseKey,
  noteId,
  phoneme,
  phonemeIndexInNote: index,
  isEdited: false,
  originalStartTimeSeconds: start,
  editedStartTimeSeconds: start,
  editedEndTimeSeconds: end,
});

// 子音で始まるノートaと、母音だけのノートbが続き、末尾の休符で終わるフレーズ
const infos = [
  createInfo(undefined, "pau", 0, 0, 1),
  createInfo(a, "k", 0, 1, 1.1),
  createInfo(a, "I", 1, 1.1, 1.3),
  createInfo(a, "a", 2, 1.3, 2),
  createInfo(b, "a", 0, 2, 3),
  createInfo(b, "pau", 1, 3, 4),
];

describe("buildPhonemeBoundaryDisplays", () => {
  it("編集済みの境界の移動プレビューは、編集前の位置からのずれとして表示する", () => {
    const edited = infos.map((info) =>
      info.noteId === a && info.phonemeIndexInNote === 1
        ? { ...info, isEdited: true, editedStartTimeSeconds: 1.2 }
        : info,
    );

    const displayed = buildPhonemeBoundaryDisplays(
      edited,
      { type: "move", noteId: a, phonemeIndexInNote: 1, offsetSeconds: 0.05 },
      frameRate,
    );

    const target = displayed.find(
      (info) => info.noteId === a && info.phonemeIndexInNote === 1,
    );
    expect(target?.displayStartTimeSeconds).toBeCloseTo(1.15);
    expect(target?.displayState).toBe("movePreview");
  });

  it("消去プレビューで次の境界を越えても、表示上は次の境界の1フレーム手前に留める", () => {
    const edited = [
      {
        ...createInfo(a, "k", 0, 1, 1.2),
        isEdited: true,
        originalStartTimeSeconds: 1.5,
      },
      createInfo(a, "a", 1, 1.2, 2),
    ];

    const displayed = buildPhonemeBoundaryDisplays(
      edited,
      { type: "erase", targets: [{ noteId: a, phonemeIndexInNote: 0 }] },
      frameRate,
    );

    expect(displayed[0].displayStartTimeSeconds).toBeCloseTo(
      1.2 - 1 / frameRate,
    );
  });

  it("表示順の制約を適用しても、元の音素タイミング情報を変更しない", () => {
    const edited = [
      {
        ...createInfo(a, "k", 0, 1, 1.2),
        isEdited: true,
        originalStartTimeSeconds: 1.5,
      },
      createInfo(a, "a", 1, 1.2, 2),
    ];
    const before = structuredClone(edited);

    buildPhonemeBoundaryDisplays(
      edited,
      { type: "erase", targets: [{ noteId: a, phonemeIndexInNote: 0 }] },
      frameRate,
    );

    expect(edited).toEqual(before);
  });
});

describe("buildNotePhonemeBands", () => {
  it("ノートごとに音素をまとめ、最後のノートの帯は末尾の休符の開始で閉じる", () => {
    const bands = buildNotePhonemeBands(
      buildPhonemeBoundaryDisplays(infos, undefined, frameRate),
    );

    expect(
      bands.map((band) => ({
        noteId: band.noteId,
        phonemes: band.boundaries.map((boundary) => boundary.phoneme),
        startTimeSeconds: band.startTimeSeconds,
        endTimeSeconds: band.endTimeSeconds,
      })),
    ).toEqual([
      {
        noteId: a,
        phonemes: ["k", "I", "a"],
        startTimeSeconds: 1,
        endTimeSeconds: 2,
      },
      {
        noteId: b,
        phonemes: ["a", "pau"],
        startTimeSeconds: 2,
        endTimeSeconds: 3,
      },
    ]);
  });

  it("ノートの先頭の境界を動かすと、前のノートの帯の終わりも同じ位置に追従する", () => {
    const bands = buildNotePhonemeBands(
      buildPhonemeBoundaryDisplays(
        infos,
        { type: "move", noteId: b, phonemeIndexInNote: 0, offsetSeconds: -0.2 },
        frameRate,
      ),
    );

    expect(bands[0].endTimeSeconds).toBe(1.8);
    expect(bands[1].startTimeSeconds).toBe(1.8);
  });

  it("末尾の休符を動かすと帯が伸び、次のフレーズとの間は塗らない", () => {
    const nextPhrase = {
      ...createInfo(NoteId("c"), "a", 0, 5, 6),
      phraseKey: PhraseKey("next"),
    };

    const bands = buildNotePhonemeBands(
      buildPhonemeBoundaryDisplays(
        [...infos, nextPhrase],
        { type: "move", noteId: b, phonemeIndexInNote: 1, offsetSeconds: 0.25 },
        frameRate,
      ),
    );

    expect(bands[1].endTimeSeconds).toBe(3.25);
    expect(bands[2].startTimeSeconds).toBe(5);
  });

  it("消去プレビューでは、編集前の位置に戻した境界に前のノートの帯も追従する", () => {
    const edited = infos.map((info) =>
      info.noteId === b && info.phonemeIndexInNote === 0
        ? { ...info, isEdited: true, editedStartTimeSeconds: 2.2 }
        : info,
    );

    const bands = buildNotePhonemeBands(
      buildPhonemeBoundaryDisplays(
        edited,
        { type: "erase", targets: [{ noteId: b, phonemeIndexInNote: 0 }] },
        frameRate,
      ),
    );

    expect(bands[0].endTimeSeconds).toBe(2);
    expect(bands[1].startTimeSeconds).toBe(2);
    expect(bands[1].boundaries[0].displayState).toBe("default");
  });
});
