import type { Note, Tempo } from "@/domain/project/type";
import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import type { VolumePreviewEdit } from "@/sing/volumeEditorStateMachine/common";
import type { VolumeEditMode } from "@/sing/volumeEditMode";
import {
  moveVolumeEditData,
  noteToVolumeEditFrameRange,
  type VolumeEditMove,
} from "@/sing/volumeEditNoteFollow";
import {
  getOverlappingVolumeEditableFrameRanges,
  maskVolumeEditDataByEditableRanges,
  mergeVolumeEditableFrameRanges,
  type VolumeEditFrameRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";

type VolumeEditDisplayNote = Pick<Note, "id" | "position" | "duration">;

export type VolumeEditDisplayData = {
  effectiveFramewise: number[];
  previewEraseRanges: VolumeEditFrameRange[];
};

type BuildVolumeEditDisplayDataOptions = {
  volumeEditData: readonly number[];
  previewEdit?: VolumePreviewEdit;
  noteMovePreview?: readonly VolumeEditDisplayNote[];
  notes: readonly VolumeEditDisplayNote[];
  editableRanges: readonly VolumeEditableFrameRange[];
  tempos: Tempo[];
  tpqn: number;
  frameRate: number;
  volumeEditMode: VolumeEditMode;
};

const applyPreviewEdit = (
  volumeEditData: readonly number[],
  previewEdit: VolumePreviewEdit | undefined,
  editableRanges: readonly VolumeEditableFrameRange[],
  volumeEditMode: VolumeEditMode,
) => {
  const previewEraseRanges: VolumeEditFrameRange[] = [];

  if (previewEdit == undefined) {
    return { editFramewise: volumeEditData, previewEraseRanges };
  }

  const editFramewise = [...volumeEditData];
  if (previewEdit.type === "draw") {
    const startFrame = Math.max(0, previewEdit.startFrame);
    const endFrame = startFrame + previewEdit.data.length;
    if (editFramewise.length < endFrame) {
      editFramewise.push(
        ...new Array<number>(endFrame - editFramewise.length).fill(
          VALUE_INDICATING_NO_DATA,
        ),
      );
    }
    const maskedPreview = maskVolumeEditDataByEditableRanges(
      { values: previewEdit.data, startFrame: previewEdit.startFrame },
      editableRanges,
    );
    for (const [i, rawValue] of maskedPreview.entries()) {
      if (rawValue === VALUE_INDICATING_NO_DATA) continue;
      editFramewise[startFrame + i] = volumeEditMode.clampStoredValue(rawValue);
    }
  } else {
    const startFrame = Math.max(0, previewEdit.startFrame);
    const endFrame = startFrame + previewEdit.frameLength;
    if (editFramewise.length < endFrame) {
      editFramewise.push(
        ...new Array<number>(endFrame - editFramewise.length).fill(
          VALUE_INDICATING_NO_DATA,
        ),
      );
    }
    const overlaps = getOverlappingVolumeEditableFrameRanges(
      startFrame,
      previewEdit.frameLength,
      editableRanges,
    );
    for (const overlap of overlaps) {
      editFramewise.fill(
        VALUE_INDICATING_NO_DATA,
        overlap.startFrame,
        overlap.endFrame,
      );
      previewEraseRanges.push({ ...overlap });
    }
  }

  return { editFramewise, previewEraseRanges };
};

const subtractVolumeEditableFrameRange = (
  ranges: readonly VolumeEditableFrameRange[],
  rangeToSubtract: VolumeEditFrameRange,
) => {
  const result: VolumeEditableFrameRange[] = [];
  for (const range of ranges) {
    if (
      range.endFrame <= rangeToSubtract.startFrame ||
      rangeToSubtract.endFrame <= range.startFrame
    ) {
      result.push({ ...range });
      continue;
    }
    if (range.startFrame < rangeToSubtract.startFrame) {
      result.push({
        startFrame: range.startFrame,
        endFrame: rangeToSubtract.startFrame,
      });
    }
    if (rangeToSubtract.endFrame < range.endFrame) {
      result.push({
        startFrame: rangeToSubtract.endFrame,
        endFrame: range.endFrame,
      });
    }
  }
  return result;
};

const moveVolumeEditableRangesForPreview = (
  editableRanges: readonly VolumeEditableFrameRange[],
  moves: readonly VolumeEditMove[],
) => {
  let remainingRanges = [...editableRanges];
  for (const move of moves) {
    remainingRanges = subtractVolumeEditableFrameRange(
      remainingRanges,
      move.srcRange,
    );
  }

  const movedRanges: VolumeEditableFrameRange[] = [];
  for (const move of moves) {
    const srcLength = move.srcRange.endFrame - move.srcRange.startFrame;
    const destLength = move.destRange.endFrame - move.destRange.startFrame;
    if (srcLength <= 0 || destLength <= 0) {
      continue;
    }
    const sourceOverlaps = getOverlappingVolumeEditableFrameRanges(
      move.srcRange.startFrame,
      srcLength,
      editableRanges,
    );
    for (const sourceOverlap of sourceOverlaps) {
      const startFrame =
        move.destRange.startFrame +
        Math.floor(
          ((sourceOverlap.startFrame - move.srcRange.startFrame) * destLength) /
            srcLength,
        );
      const endFrame =
        move.destRange.startFrame +
        Math.ceil(
          ((sourceOverlap.endFrame - move.srcRange.startFrame) * destLength) /
            srcLength,
        );
      if (startFrame < endFrame) {
        movedRanges.push({ startFrame, endFrame });
      }
    }
  }
  return mergeVolumeEditableFrameRanges([...remainingRanges, ...movedRanges]);
};

const applyNoteMovePreview = (
  editFramewise: readonly number[],
  noteMovePreview: readonly VolumeEditDisplayNote[] | undefined,
  notes: readonly VolumeEditDisplayNote[],
  editableRanges: readonly VolumeEditableFrameRange[],
  tempos: Tempo[],
  tpqn: number,
  frameRate: number,
) => {
  if (noteMovePreview == undefined || noteMovePreview.length === 0) {
    return { editFramewise, previewEditableRanges: editableRanges };
  }

  const currentNotes = new Map(notes.map((note) => [note.id, note]));
  const moves: VolumeEditMove[] = [];
  for (const previewNote of noteMovePreview) {
    const currentNote = currentNotes.get(previewNote.id);
    if (
      currentNote == undefined ||
      currentNote.position === previewNote.position
    ) {
      continue;
    }
    moves.push({
      srcRange: noteToVolumeEditFrameRange(
        currentNote,
        tempos,
        tpqn,
        frameRate,
      ),
      destRange: noteToVolumeEditFrameRange(
        previewNote,
        tempos,
        tpqn,
        frameRate,
      ),
    });
  }
  if (moves.length === 0) {
    return { editFramewise, previewEditableRanges: editableRanges };
  }

  return {
    editFramewise: moveVolumeEditData(editFramewise, moves),
    previewEditableRanges: moveVolumeEditableRangesForPreview(
      editableRanges,
      moves,
    ),
  };
};

const buildEffectiveFramewise = (
  editFramewise: readonly number[],
  editableRanges: readonly VolumeEditableFrameRange[],
  volumeEditMode: VolumeEditMode,
) => {
  const lastRangeEndFrame = editableRanges.at(-1)?.endFrame ?? 0;
  const effectiveFramewise = new Array<number>(
    Math.max(editFramewise.length, lastRangeEndFrame),
  ).fill(VALUE_INDICATING_NO_DATA);
  for (const [i, value] of editFramewise.entries()) {
    effectiveFramewise[i] = value;
  }

  const neutralStoredValue = volumeEditMode.toStoredValue(0);
  for (const range of editableRanges) {
    for (let i = range.startFrame; i < range.endFrame; i++) {
      if (effectiveFramewise[i] === VALUE_INDICATING_NO_DATA) {
        effectiveFramewise[i] = neutralStoredValue;
      }
    }
  }
  return effectiveFramewise;
};

export const buildVolumeEditDisplayData = ({
  volumeEditData,
  previewEdit,
  noteMovePreview,
  notes,
  editableRanges,
  tempos,
  tpqn,
  frameRate,
  volumeEditMode,
}: BuildVolumeEditDisplayDataOptions): VolumeEditDisplayData => {
  const { editFramewise, previewEraseRanges } = applyPreviewEdit(
    volumeEditData,
    previewEdit,
    editableRanges,
    volumeEditMode,
  );
  const maskedEdit = maskVolumeEditDataByEditableRanges(
    { values: editFramewise, startFrame: 0 },
    editableRanges,
  );
  const { editFramewise: previewedEdit, previewEditableRanges } =
    applyNoteMovePreview(
      maskedEdit,
      noteMovePreview,
      notes,
      editableRanges,
      tempos,
      tpqn,
      frameRate,
    );

  return {
    effectiveFramewise: buildEffectiveFramewise(
      previewedEdit,
      previewEditableRanges,
      volumeEditMode,
    ),
    previewEraseRanges,
  };
};
