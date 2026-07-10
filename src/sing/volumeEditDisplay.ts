import type { VolumeAdjustmentValue } from "@/domain/project/type";
import type { VolumePreviewEdit } from "@/sing/volumeEditorStateMachine/common";
import type { VolumeEditMode } from "@/sing/volumeEditMode";
import {
  getOverlappingVolumeEditableFrameRanges,
  maskVolumeAdjustmentDataByEditableRanges,
  type VolumeEditFrameRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";

export type VolumeEditDisplayData = {
  effectiveFramewise: VolumeAdjustmentValue[];
  previewEraseRanges: VolumeEditFrameRange[];
};

type BuildVolumeEditDisplayDataOptions = {
  volumeAdjustmentData: readonly VolumeAdjustmentValue[];
  previewEdit?: VolumePreviewEdit;
  editableRanges: readonly VolumeEditableFrameRange[];
  volumeEditMode: VolumeEditMode;
};

const applyPreviewEdit = (
  volumeAdjustmentData: readonly VolumeAdjustmentValue[],
  previewEdit: VolumePreviewEdit | undefined,
  editableRanges: readonly VolumeEditableFrameRange[],
  volumeEditMode: VolumeEditMode,
) => {
  const previewEraseRanges: VolumeEditFrameRange[] = [];

  if (previewEdit == undefined) {
    return { editFramewise: volumeAdjustmentData, previewEraseRanges };
  }

  const editFramewise = [...volumeAdjustmentData];
  if (previewEdit.type === "draw") {
    const startFrame = Math.max(0, previewEdit.startFrame);
    const endFrame = startFrame + previewEdit.data.length;
    if (editFramewise.length < endFrame) {
      editFramewise.push(
        ...new Array<null>(endFrame - editFramewise.length).fill(null),
      );
    }
    const maskedPreview = maskVolumeAdjustmentDataByEditableRanges(
      { values: previewEdit.data, startFrame: previewEdit.startFrame },
      editableRanges,
    );
    for (const [i, rawValue] of maskedPreview.entries()) {
      if (rawValue == null) continue;
      editFramewise[startFrame + i] = volumeEditMode.clampStoredValue(rawValue);
    }
  } else {
    const startFrame = Math.max(0, previewEdit.startFrame);
    const endFrame = startFrame + previewEdit.frameLength;
    if (editFramewise.length < endFrame) {
      editFramewise.push(
        ...new Array<null>(endFrame - editFramewise.length).fill(null),
      );
    }
    const overlaps = getOverlappingVolumeEditableFrameRanges(
      startFrame,
      previewEdit.frameLength,
      editableRanges,
    );
    for (const overlap of overlaps) {
      editFramewise.fill(null, overlap.startFrame, overlap.endFrame);
      previewEraseRanges.push({ ...overlap });
    }
  }

  return { editFramewise, previewEraseRanges };
};

const buildEffectiveFramewise = (
  editFramewise: readonly VolumeAdjustmentValue[],
  editableRanges: readonly VolumeEditableFrameRange[],
  volumeEditMode: VolumeEditMode,
) => {
  const lastRangeEndFrame = editableRanges.at(-1)?.endFrame ?? 0;
  const effectiveFramewise = new Array<VolumeAdjustmentValue>(
    Math.max(editFramewise.length, lastRangeEndFrame),
  ).fill(null);
  for (const [i, value] of editFramewise.entries()) {
    effectiveFramewise[i] = value;
  }

  const neutralStoredValue = volumeEditMode.toStoredValue(0);
  for (const range of editableRanges) {
    for (let i = range.startFrame; i < range.endFrame; i++) {
      if (effectiveFramewise[i] == null) {
        effectiveFramewise[i] = neutralStoredValue;
      }
    }
  }
  return effectiveFramewise;
};

export const buildVolumeEditDisplayData = ({
  volumeAdjustmentData,
  previewEdit,
  editableRanges,
  volumeEditMode,
}: BuildVolumeEditDisplayDataOptions): VolumeEditDisplayData => {
  const { editFramewise, previewEraseRanges } = applyPreviewEdit(
    volumeAdjustmentData,
    previewEdit,
    editableRanges,
    volumeEditMode,
  );
  const maskedEdit = maskVolumeAdjustmentDataByEditableRanges(
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
