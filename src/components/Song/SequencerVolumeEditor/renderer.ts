import * as PIXI from "pixi.js";
import { VOLUME_EDITOR_LAYOUT, VOLUME_EDITOR_LINE_WIDTH } from "./style";
import type { VolumeEditValue } from "@/domain/project/type";
import {
  findFirstVolumePointAfter,
  findFirstVolumePointAtOrAfter,
  computeVisibleVolumePointRange,
  VolumeLine,
  volumeBaseXToScreenX,
  volumeNormalizedYToScreenY,
} from "@/song/graphics/volumeLine";
import type { VolumeSegment, VolumeViewInfo } from "@/song/graphics/volumeLine";
import type { Color } from "@/song/graphics/lineStrip";
import type { VolumeValueScale } from "@/song/volumeValueScale";
import { getLast } from "@/song/utility";

export type VolumeEditorBaseXRange = {
  readonly startBaseX: number;
  readonly endBaseX: number;
};

export type VolumeEditorLineColors = {
  readonly line: Color;
  /** ホバー中・描画中の区間に使う線色。端点の枠線も同じ色にする。 */
  readonly feedback: Color;
  /** 0dB基準線とカーブの間の塗り。 */
  readonly areaContainer: Color;
  /** 区間端に置く丸の塗り。枠線は線色を使う。 */
  readonly endpointContainer: Color;
  readonly erasePreviewOverlay: Color;
};

type VolumeEditorRendererUpdateOptions = {
  readonly viewInfo: VolumeViewInfo;
  readonly volumeSegments: VolumeSegment[];
  readonly feedbackRange?: VolumeEditorBaseXRange;
  readonly erasePreviewRanges: readonly VolumeEditorBaseXRange[];
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

/** 0dBを跨ぐ面の自己交差を避け、基準線とカーブの間を塗れるようにする。 */
export const splitVolumeSegmentAtBaseline = (
  segment: VolumeSegment,
  baseline: number,
) => {
  const runs: VolumeSegment[] = [];
  let run: VolumeSegment = [];
  let side = 0;
  for (const point of segment) {
    const pointSide = Math.sign(point.normalizedY - baseline);
    if (side !== 0 && pointSide !== 0 && side !== pointSide) {
      const previous = getLast(run);
      const ratio =
        (baseline - previous.normalizedY) /
        (point.normalizedY - previous.normalizedY);
      const crossing = {
        baseX: previous.baseX + (point.baseX - previous.baseX) * ratio,
        normalizedY: baseline,
      };
      run.push(crossing);
      runs.push(run);
      run = [crossing];
    }
    run.push(point);
    if (pointSide === 0) {
      if (side !== 0 && run.length >= 2) runs.push(run);
      // 平らな0dB区間には面積がない。次の傾斜の始点だけ残す。
      run = [point];
    }
    side = pointSide;
  }
  if (side !== 0 && run.length >= 2) runs.push(run);
  return runs;
};

/**
 * 各区間の両端に置く丸の画面位置を返す。
 * 丸が代表する区間の範囲も返し、ハイライトの判定に使う。
 */
export const buildVolumeEndpointNodes = (
  segments: VolumeSegment[],
  viewInfo: VolumeViewInfo,
) => {
  const endpoints = segments.flatMap((segment) =>
    segment.length < 2 ? [] : [segment[0], getLast(segment)],
  );
  const nodes: ({ x: number; y: number } & VolumeEditorBaseXRange)[] = [];
  for (let i = 0; i < endpoints.length; i++) {
    const point = endpoints[i];
    const next = endpoints[i + 1];
    let baseX = point.baseX;
    let normalizedY = point.normalizedY;
    let endBaseX = baseX;
    // 可視範囲で切る前の区間端を使う。画面端を区間端のように見せない。
    // 隣り合う丸が重なると区間の切れ目が読めないため、横距離が8px未満なら中間位置に統合する。
    if (
      next != undefined &&
      (next.baseX - baseX) * viewInfo.zoomX <
        VOLUME_EDITOR_LAYOUT.endpointMergeDistancePx
    ) {
      baseX = (baseX + next.baseX) / 2;
      normalizedY = (normalizedY + next.normalizedY) / 2;
      endBaseX = next.baseX;
      i++;
    }
    const x = volumeBaseXToScreenX(baseX, viewInfo);
    if (x < viewInfo.leftPadding || x > viewInfo.viewportWidth) continue;
    nodes.push({
      x,
      y: volumeNormalizedYToScreenY(normalizedY, viewInfo.viewportHeight),
      startBaseX: point.baseX,
      endBaseX,
    });
  }
  return nodes;
};

/** 統合した端点も、実効線と同じ範囲を強調する。 */
export const isVolumeEndpointInFeedbackRange = (
  range: VolumeEditorBaseXRange,
  feedbackRange: VolumeEditorBaseXRange | undefined,
) => {
  return (
    feedbackRange != undefined &&
    range.startBaseX <= feedbackRange.endBaseX &&
    feedbackRange.startBaseX <= range.endBaseX
  );
};

export const filterVolumeSegmentsByBaseXRange = (
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

    const startIndex = findFirstVolumePointAtOrAfter(segment, range.startBaseX);
    // 終了境界上の点まで含めて切り出すため、終了側は「より大きい」で探す
    const endIndex = findFirstVolumePointAfter(segment, range.endBaseX);
    const clippedSegment = segment.slice(startIndex, endIndex);
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
  private readonly areaGraphics: PIXI.Graphics;
  private readonly pointGraphics: PIXI.Graphics;
  private readonly effectiveVolumeLine: VolumeLine;
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
    this.areaGraphics = new PIXI.Graphics();
    this.pointGraphics = new PIXI.Graphics();
    this.effectiveVolumeLine = new VolumeLine({
      color: initialColors.line,
      width: VOLUME_EDITOR_LINE_WIDTH.volume,
      isVisible: true,
    });
    this.volumeFeedbackLine = new VolumeLine({
      color: initialColors.feedback,
      width: VOLUME_EDITOR_LINE_WIDTH.hoveredVolume,
      isVisible: false,
    });

    this.stage.addChild(this.areaGraphics);
    this.stage.addChild(this.erasePreviewOverlay);
    this.stage.addChild(this.effectiveVolumeLine.container);
    this.stage.addChild(this.volumeFeedbackLine.container);
    this.stage.addChild(this.pointGraphics);

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
    this.effectiveVolumeLine.destroy();
    this.volumeFeedbackLine.destroy();
    this.areaGraphics.destroy();
    this.pointGraphics.destroy();
    this.erasePreviewOverlay.destroy();
    this.stage.destroy();
    this.renderer.destroy({ removeView: true });
  }

  private render() {
    const options = this.updateOptions;
    if (options == undefined || this.destroyed) {
      return;
    }

    this.renderVolumeArea(options);
    this.renderErasePreview(options);

    this.effectiveVolumeLine.color = options.colors.line;
    this.effectiveVolumeLine.update(options.volumeSegments, options.viewInfo);

    const feedbackSegments = filterVolumeSegmentsByBaseXRange(
      options.volumeSegments,
      options.feedbackRange,
    );
    this.volumeFeedbackLine.color = options.colors.feedback;
    this.volumeFeedbackLine.isVisible = feedbackSegments.length > 0;
    this.volumeFeedbackLine.update(feedbackSegments, options.viewInfo);
    this.renderVolumePoints(options);

    this.renderer.render(this.stage);
  }

  private renderVolumeArea(options: VolumeEditorRendererUpdateOptions) {
    this.areaGraphics.clear();
    const { viewInfo, valueScale, colors } = options;
    const baseline = valueScale.dbToNormalizedY(0);
    const baselineY = volumeNormalizedYToScreenY(
      baseline,
      viewInfo.viewportHeight,
    );
    const fill = {
      color: colors.areaContainer.toRgbNumber(),
      alpha: colors.areaContainer.toAlphaFloat(),
    };
    for (const segment of options.volumeSegments) {
      const { startIndex, endIndex } = computeVisibleVolumePointRange(
        segment,
        viewInfo,
      );
      const runs = splitVolumeSegmentAtBaseline(
        segment.slice(startIndex, endIndex),
        baseline,
      );
      for (const run of runs) {
        this.areaGraphics.moveTo(
          volumeBaseXToScreenX(run[0].baseX, viewInfo),
          baselineY,
        );
        for (const point of run) {
          this.areaGraphics.lineTo(
            volumeBaseXToScreenX(point.baseX, viewInfo),
            volumeNormalizedYToScreenY(
              point.normalizedY,
              viewInfo.viewportHeight,
            ),
          );
        }
        this.areaGraphics
          .lineTo(volumeBaseXToScreenX(getLast(run).baseX, viewInfo), baselineY)
          .closePath()
          .fill(fill);
      }
    }
  }

  private renderVolumePoints(options: VolumeEditorRendererUpdateOptions) {
    this.pointGraphics.clear();
    for (const node of buildVolumeEndpointNodes(
      options.volumeSegments,
      options.viewInfo,
    )) {
      const color = isVolumeEndpointInFeedbackRange(node, options.feedbackRange)
        ? options.colors.feedback
        : options.colors.line;
      this.pointGraphics
        .circle(node.x, node.y, VOLUME_EDITOR_LAYOUT.endpointRadiusPx)
        .fill({
          color: options.colors.endpointContainer.toRgbNumber(),
          alpha: options.colors.endpointContainer.toAlphaFloat(),
        })
        .stroke({
          width: VOLUME_EDITOR_LINE_WIDTH.endpoint,
          color: color.toRgbNumber(),
          alpha: color.toAlphaFloat(),
        });
    }
  }

  private renderErasePreview(options: VolumeEditorRendererUpdateOptions) {
    this.erasePreviewOverlay.clear();
    for (const range of options.erasePreviewRanges) {
      if (range.endBaseX <= range.startBaseX) {
        continue;
      }
      const startX = volumeBaseXToScreenX(range.startBaseX, options.viewInfo);
      const endX = volumeBaseXToScreenX(range.endBaseX, options.viewInfo);
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
          alpha: options.colors.erasePreviewOverlay.toAlphaFloat(),
        });
    }
  }
}
