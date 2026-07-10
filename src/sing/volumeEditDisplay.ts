import { VALUE_INDICATING_NO_DATA } from "@/sing/domain";
import type { VolumePreviewEdit } from "@/sing/volumeEditorStateMachine/common";
import type { VolumeEditMode } from "@/sing/volumeEditMode";
import {
  getOverlappingVolumeEditableFrameRanges,
  maskVolumeEditDataByEditableRanges,
  type VolumeEditFrameRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";

export type VolumeEditDisplayData = {
  effectiveFramewise: number[];
  previewEraseRanges: VolumeEditFrameRange[];
};

type BuildVolumeEditDisplayDataOptions = {
  volumeEditData: readonly number[];
  previewEdit?: VolumePreviewEdit;
  editableRanges: readonly VolumeEditableFrameRange[];
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
  editableRanges,
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
  return {
    effectiveFramewise: buildEffectiveFramewise(
      maskedEdit,
      editableRanges,
      volumeEditMode,
    ),
    previewEraseRanges,
  };
};
