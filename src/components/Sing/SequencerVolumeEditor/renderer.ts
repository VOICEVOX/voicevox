import * as PIXI from "pixi.js";
import { VOLUME_EDITOR_ALPHA, VOLUME_EDITOR_LINE_WIDTH } from "./style";
import type { VolumeEditValue } from "@/domain/project/type";
import {
  VolumeLine,
  volumeNormalizedYToScreenY,
} from "@/sing/graphics/volumeLine";
import type { VolumeSegment, VolumeViewInfo } from "@/sing/graphics/volumeLine";
import type { Color } from "@/sing/graphics/lineStrip";
import type { DbGridLine, VolumeValueScale } from "@/sing/volumeValueScale";

export type VolumeEditorBaseXRange = {
  readonly startBaseX: number;
  readonly endBaseX: number;
};

export type VolumeEditorLineColors = {
  readonly edited: Color;
  readonly feedback: Color;
  readonly gridBaseline: Color;
  readonly horizontalGrid: Color;
  readonly erasePreviewOverlay: Color;
};

type VolumeEditorRendererUpdateOptions = {
  readonly viewInfo: VolumeViewInfo;
  readonly volumeSegments: VolumeSegment[];
  readonly feedbackRange?: VolumeEditorBaseXRange;
  readonly erasePreviewRanges: readonly VolumeEditorBaseXRange[];
  readonly gridLines: readonly DbGridLine[];
  readonly valueScale: VolumeValueScale;
  readonly colors: VolumeEditorLineColors;
};

export const buildVolumeSegments = (
  framewiseData: readonly VolumeEditValue[],
  options: {
    frameToBaseX: (frame: number) => number;
    valueToNormalizedY: (value: number) => number;
  },
) => {
  const segments: VolumeSegment[] = [];
  let current: VolumeSegment | undefined;

  for (const [frame, value] of framewiseData.entries()) {
    if (value == null) {
      if (current != undefined && current.length >= 2) {
        segments.push(current);
      }
      current = undefined;
      continue;
    }

    const baseX = options.frameToBaseX(frame);
    if (!Number.isFinite(baseX)) {
      throw new Error("baseX must be finite.");
    }

    if (current == undefined) {
      current = [];
    }
    current.push({
      baseX,
      normalizedY: options.valueToNormalizedY(value),
    });
  }

  if (current != undefined && current.length >= 2) {
    segments.push(current);
  }
  return segments;
};

const filterVolumeSegmentsByBaseXRange = (
  segments: VolumeSegment[],
  range: VolumeEditorBaseXRange | undefined,
) => {
  if (range == undefined) {
    return [];
  }

  const clippedSegments: VolumeSegment[] = [];
  for (const segment of segments) {
    const firstPoint = segment[0];
    const lastPoint = segment.at(-1);
    if (
      firstPoint == undefined ||
      lastPoint == undefined ||
      lastPoint.baseX < range.startBaseX ||
      range.endBaseX < firstPoint.baseX
    ) {
      continue;
    }

    const clippedSegment = segment.filter(
      (point) =>
        range.startBaseX <= point.baseX && point.baseX <= range.endBaseX,
    );
    if (clippedSegment.length >= 2) {
      clippedSegments.push(clippedSegment);
    }
  }
  return clippedSegments;
};

export class VolumeEditorRenderer {
  private readonly renderer: PIXI.Renderer;
  private readonly stage: PIXI.Container;
  private readonly erasePreviewOverlay: PIXI.Graphics;
  private readonly gridGraphics: PIXI.Graphics;
  private readonly editedVolumeLine: VolumeLine;
  private readonly volumeFeedbackLine: VolumeLine;

  private requestId: number | undefined;
  private renderInNextFrame = false;
  private updateOptions: VolumeEditorRendererUpdateOptions | undefined;
  private destroyed = false;

  private constructor(
    renderer: PIXI.Renderer,
    initialColors: VolumeEditorLineColors,
  ) {
    this.renderer = renderer;
    this.stage = new PIXI.Container();
    this.erasePreviewOverlay = new PIXI.Graphics();
    this.gridGraphics = new PIXI.Graphics();
    this.editedVolumeLine = new VolumeLine({
      color: initialColors.edited,
      width: VOLUME_EDITOR_LINE_WIDTH.editedVolume,
      isVisible: true,
    });
    this.volumeFeedbackLine = new VolumeLine({
      color: initialColors.feedback,
      width: VOLUME_EDITOR_LINE_WIDTH.hoveredVolume,
      isVisible: false,
    });

    this.stage.addChild(this.erasePreviewOverlay);
    this.stage.addChild(this.gridGraphics);
    this.stage.addChild(this.editedVolumeLine.container);
    this.stage.addChild(this.volumeFeedbackLine.container);

    const renderIfNeeded = () => {
      if (this.renderInNextFrame) {
        this.render();
        this.renderInNextFrame = false;
      }
      this.requestId = window.requestAnimationFrame(renderIfNeeded);
    };
    this.requestId = window.requestAnimationFrame(renderIfNeeded);
  }

  static async create(options: {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    initialColors: VolumeEditorLineColors;
    signal: AbortSignal;
  }) {
    const renderer = await PIXI.autoDetectRenderer({
      canvas: options.canvas,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      width: options.width,
      height: options.height,
    });
    if (options.signal.aborted) {
      renderer.destroy({ removeView: true });
      return undefined;
    }
    return new VolumeEditorRenderer(renderer, options.initialColors);
  }

  update(
    options: VolumeEditorRendererUpdateOptions,
    renderImmediately = false,
  ) {
    this.updateOptions = options;
    if (renderImmediately) {
      this.renderInNextFrame = false;
      this.render();
    } else {
      this.renderInNextFrame = true;
    }
  }

  resize(width: number, height: number) {
    this.renderer.resize(width, height);
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    if (this.requestId != undefined) {
      window.cancelAnimationFrame(this.requestId);
    }
    this.editedVolumeLine.destroy();
    this.volumeFeedbackLine.destroy();
    this.gridGraphics.destroy();
    this.erasePreviewOverlay.destroy();
    this.stage.destroy();
    this.renderer.destroy({ removeView: true });
  }

  private render() {
    const options = this.updateOptions;
    if (options == undefined || this.destroyed) {
      return;
    }

    this.renderHorizontalGrid(options);
    this.renderErasePreview(options);

    this.editedVolumeLine.color = options.colors.edited;
    this.editedVolumeLine.width = VOLUME_EDITOR_LINE_WIDTH.editedVolume;
    this.editedVolumeLine.update(options.volumeSegments, options.viewInfo);

    const feedbackSegments = filterVolumeSegmentsByBaseXRange(
      options.volumeSegments,
      options.feedbackRange,
    );
    this.volumeFeedbackLine.color = options.colors.feedback;
    this.volumeFeedbackLine.isVisible = feedbackSegments.length > 0;
    this.volumeFeedbackLine.update(feedbackSegments, options.viewInfo);

    this.renderer.render(this.stage);
  }

  private renderHorizontalGrid(options: VolumeEditorRendererUpdateOptions) {
    this.gridGraphics.clear();
    const {
      viewportHeight: height,
      viewportWidth: width,
      leftPadding,
    } = options.viewInfo;
    if (width <= leftPadding) {
      return;
    }

    for (const line of options.gridLines) {
      if (line.labelOnly === true) {
        continue;
      }
      // VolumeLineと同じ座標式にし、高さの偶奇による最大1pxのずれを防ぐ。
      const y = volumeNormalizedYToScreenY(
        options.valueScale.dbToNormalizedY(line.db),
        height,
      );
      const color =
        line.kind === "baseline"
          ? options.colors.gridBaseline
          : options.colors.horizontalGrid;
      this.gridGraphics
        .moveTo(leftPadding, y)
        .lineTo(width, y)
        .stroke({
          width: VOLUME_EDITOR_LINE_WIDTH.horizontalGrid,
          color: color.toRgbNumber(),
          alpha:
            line.kind === "baseline"
              ? color.toAlphaFloat()
              : line.kind === "minor"
                ? VOLUME_EDITOR_ALPHA.minorGrid
                : 1,
        });
    }
  }

  private renderErasePreview(options: VolumeEditorRendererUpdateOptions) {
    this.erasePreviewOverlay.clear();
    for (const range of options.erasePreviewRanges) {
      if (range.endBaseX <= range.startBaseX) {
        continue;
      }
      const startX =
        range.startBaseX * options.viewInfo.zoomX -
        options.viewInfo.offsetX +
        options.viewInfo.leftPadding;
      const endX =
        range.endBaseX * options.viewInfo.zoomX -
        options.viewInfo.offsetX +
        options.viewInfo.leftPadding;
      const clampedStart = Math.max(0, startX);
      const clampedEnd = Math.min(options.viewInfo.viewportWidth, endX);
      if (clampedEnd <= clampedStart) {
        continue;
      }
      this.erasePreviewOverlay
        .rect(
          clampedStart,
          0,
          clampedEnd - clampedStart,
          options.viewInfo.viewportHeight,
        )
        .fill({
          color: options.colors.erasePreviewOverlay.toRgbNumber(),
          alpha: VOLUME_EDITOR_ALPHA.erasePreviewOverlay,
        });
    }
  }
}
