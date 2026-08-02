import type { VolumeEditValue } from "@/domain/project/type";
import type { VolumePreviewEdit } from "@/sing/volumeEditorStateMachine/common";
import {
  getOverlappingVolumeEditableFrameRanges,
  maskVolumeEditDataByEditableRanges,
  type VolumeEditFrameRange,
  type VolumeEditableFrameRange,
} from "@/sing/volumeEditRanges";

export type VolumeEditDisplayData = {
  /** 編集値にプレビューを適用した実効値。未編集フレームは0dBで表す */
  effectiveFramewise: VolumeEditValue[];
  previewEraseRanges: VolumeEditFrameRange[];
};

type BuildVolumeEditDisplayDataOptions = {
  volumeEditData: readonly VolumeEditValue[];
  previewEdit?: VolumePreviewEdit;
  editableRanges: readonly VolumeEditableFrameRange[];
};

const applyPreviewEdit = (
  volumeEditData: readonly VolumeEditValue[],
  previewEdit: VolumePreviewEdit | undefined,
  editableRanges: readonly VolumeEditableFrameRange[],
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
        ...new Array<null>(endFrame - editFramewise.length).fill(null),
      );
    }
    const maskedPreview = maskVolumeEditDataByEditableRanges(
      { values: previewEdit.data, startFrame: previewEdit.startFrame },
      editableRanges,
    );
    for (const [i, rawValue] of maskedPreview.entries()) {
      if (rawValue == null) continue;
      editFramewise[startFrame + i] = rawValue;
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
  editFramewise: readonly VolumeEditValue[],
  editableRanges: readonly VolumeEditableFrameRange[],
) => {
  const lastRangeEndFrame = editableRanges.at(-1)?.endFrame ?? 0;
  const effectiveFramewise = new Array<VolumeEditValue>(
    Math.max(editFramewise.length, lastRangeEndFrame),
  ).fill(null);
  for (const [i, value] of editFramewise.entries()) {
    effectiveFramewise[i] = value;
  }

  // 未編集フレームは0dB(原音のまま)で埋めて、実効線を途切れさせない
  for (const range of editableRanges) {
    for (let i = range.startFrame; i < range.endFrame; i++) {
      if (effectiveFramewise[i] == null) {
        effectiveFramewise[i] = 0;
      }
    }
  }
  return effectiveFramewise;
};

/**
 * 保存値と操作中のプレビューから表示データを構築する。
 * editableRangesは開始フレーム順にソート済みであること。
 */
export const buildVolumeEditDisplayData = ({
  volumeEditData,
  previewEdit,
  editableRanges,
}: BuildVolumeEditDisplayDataOptions): VolumeEditDisplayData => {
  const { editFramewise, previewEraseRanges } = applyPreviewEdit(
    volumeEditData,
    previewEdit,
    editableRanges,
  );
  const maskedEdit = maskVolumeEditDataByEditableRanges(
    { values: editFramewise, startFrame: 0 },
    editableRanges,
  );
  return {
    effectiveFramewise: buildEffectiveFramewise(maskedEdit, editableRanges),
    previewEraseRanges,
  };
};
