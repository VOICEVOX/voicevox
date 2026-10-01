import { describe, expect, it } from "vitest";
import { NoteId } from "@/type/preload";
import { PhraseKey } from "@/store/type";
import type { PhonemeTimingInfo } from "@/song/phonemeTimingEditorStateMachine/common";
import {
  buildPhonemeDisplayInfos,
  groupPhonemeDisplayInfos,
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

describe("buildPhonemeDisplayInfos", () => {
  it("編集済みの境界の移動プレビューは、編集前の位置からのずれとして表示する", () => {
    const edited = infos.map((info) =>
      info.noteId === a && info.phonemeIndexInNote === 1
        ? { ...info, isEdited: true, editedStartTimeSeconds: 1.2 }
        : info,
    );

    const displayed = buildPhonemeDisplayInfos(
      edited,
      { type: "move", noteId: a, phonemeIndexInNote: 1, offsetSeconds: 0.05 },
      frameRate,
    );

    const target = displayed.find(
      (info) => info.noteId === a && info.phonemeIndexInNote === 1,
    );
    expect(target?.startTime).toBeCloseTo(1.15);
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

    const displayed = buildPhonemeDisplayInfos(
      edited,
      { type: "erase", targets: [{ noteId: a, phonemeIndexInNote: 0 }] },
      frameRate,
    );

    expect(displayed[0].startTime).toBeCloseTo(1.2 - 1 / frameRate);
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

    buildPhonemeDisplayInfos(
      edited,
      { type: "erase", targets: [{ noteId: a, phonemeIndexInNote: 0 }] },
      frameRate,
    );

    expect(edited).toEqual(before);
  });
});

describe("groupPhonemeDisplayInfos", () => {
  it("ノートごとに音素をまとめ、最後のノートの帯は末尾の休符の開始で閉じる", () => {
    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(infos, undefined, frameRate),
    );

    expect(
      groups.map((group) => ({
        noteId: group.noteId,
        phonemes: group.phonemes.map((info) => info.phoneme),
        startTime: group.startTime,
        endTime: group.endTime,
      })),
    ).toEqual([
      { noteId: a, phonemes: ["k", "I", "a"], startTime: 1, endTime: 2 },
      { noteId: b, phonemes: ["a", "pau"], startTime: 2, endTime: 3 },
    ]);
  });

  it("ノートの先頭の境界を動かすと、前のノートの帯の終わりも同じ位置に追従する", () => {
    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(
        infos,
        { type: "move", noteId: b, phonemeIndexInNote: 0, offsetSeconds: -0.2 },
        frameRate,
      ),
    );

    expect(groups[0].endTime).toBe(1.8);
    expect(groups[1].startTime).toBe(1.8);
  });

  it("末尾の休符を動かすと帯が伸び、次のフレーズとの間は塗らない", () => {
    const nextPhrase = {
      ...createInfo(NoteId("c"), "a", 0, 5, 6),
      phraseKey: PhraseKey("next"),
    };

    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(
        [...infos, nextPhrase],
        { type: "move", noteId: b, phonemeIndexInNote: 1, offsetSeconds: 0.25 },
        frameRate,
      ),
    );

    expect(groups[1].endTime).toBe(3.25);
    expect(groups[2].startTime).toBe(5);
  });

  it("消去プレビューでは、編集前の位置に戻した境界に前のノートの帯も追従する", () => {
    const edited = infos.map((info) =>
      info.noteId === b && info.phonemeIndexInNote === 0
        ? { ...info, isEdited: true, editedStartTimeSeconds: 2.2 }
        : info,
    );

    const groups = groupPhonemeDisplayInfos(
      buildPhonemeDisplayInfos(
        edited,
        { type: "erase", targets: [{ noteId: b, phonemeIndexInNote: 0 }] },
        frameRate,
      ),
    );

    expect(groups[0].endTime).toBe(2);
    expect(groups[1].startTime).toBe(2);
    expect(groups[1].phonemes[0].displayState).toBe("default");
  });
});
