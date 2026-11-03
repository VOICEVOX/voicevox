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
import { getLast } from "@/song/utility";
import type { ViewportInfo } from "@/song/viewHelper";
import { ExhaustiveError } from "@/type/utility";

export type VolumeEditorBaseXRange = {
  readonly startBaseX: number;
  readonly endBaseX: number;
};

export type VolumeEditorColors = {
  readonly line: Color;
  /** ホバー中・描画中の区間に使う線色。端点も同じ色にする。 */
  readonly feedback: Color;
  /** 0dB基準線とカーブの間の塗り。 */
  readonly areaContainer: Color;
  readonly erasePreviewOverlay: Color;
  readonly zeroLine: Color;
  readonly hoverPoint: Color;
  readonly guide: Color;
};

/** 次の操作で編集するフレームと値。 */
export type VolumeEditPosition = {
  readonly baseX: number;
  readonly normalizedY: number;
  readonly showPoint: boolean;
  /** ボリュームエディターの上端からこの位置までの縦ガイドと、この高さの横ガイドを引くか。 */
  readonly showGuides: boolean;
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

const VOLUME_EDITOR_LAYERS = [
  "zeroLine",
  "area",
  "erasePreview",
  "effectiveVolumeLine",
  "volumeFeedbackLine",
  "endpoints",
  "editPosition",
] as const;

/** 描画レイヤー。レイヤーごとに、依存する入力が変わったときだけ描き直す。 */
type VolumeEditorLayer = (typeof VOLUME_EDITOR_LAYERS)[number];

/**
 * ボリュームエディターのキャンバスに描くPIXIのレンダラーを生成する。
 * 生成を待つ間に中断されたときは、生成したレンダラーを破棄して`undefined`を返す。
 */
export const createVolumeEditorPixiRenderer = async (options: {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  signal: AbortSignal;
}) => {
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
  return renderer;
};

export class VolumeEditorRenderer {
  private readonly renderer: PIXI.Renderer;
  private readonly stage: PIXI.Container;
  private readonly zeroLineGraphics: PIXI.Graphics;
  private readonly areaGraphics: PIXI.Graphics;
  private readonly erasePreviewGraphics: PIXI.Graphics;
  private readonly effectiveVolumeLine: VolumeLine;
  private readonly volumeFeedbackLine: VolumeLine;
  private readonly endpointsGraphics: PIXI.Graphics;
  private readonly editPositionGraphics: PIXI.Graphics;

  private requestId: number | undefined;
  private viewportInfo: ViewportInfo;
  private canvasWidth: number;
  private canvasHeight: number;
  private colors: VolumeEditorColors;
  private volumeSegments: VolumeSegment[];
  /** 0dBの高さ。0dB線と面の下端に使う。 */
  private baselineNormalizedY: number;
  private erasePreviewRanges: readonly VolumeEditorBaseXRange[];
  private feedbackRange: VolumeEditorBaseXRange | undefined;
  private editPosition: VolumeEditPosition | undefined;
  // 面の組み立ては重いので、ポインタ移動のたびに変わる値では組み直さない
  private readonly dirtyLayers = new Set<VolumeEditorLayer>(
    VOLUME_EDITOR_LAYERS,
  );
  private destroyed = false;

  /** `renderer`は、このクラスの`destroy`で破棄する。 */
  constructor(
    renderer: PIXI.Renderer,
    options: {
      width: number;
      height: number;
      viewportInfo: ViewportInfo;
      colors: VolumeEditorColors;
      volumeSegments: VolumeSegment[];
      baselineNormalizedY: number;
      erasePreviewRanges: readonly VolumeEditorBaseXRange[];
      feedbackRange: VolumeEditorBaseXRange | undefined;
      editPosition: VolumeEditPosition | undefined;
    },
  ) {
    this.renderer = renderer;
    this.canvasWidth = options.width;
    this.canvasHeight = options.height;
    this.viewportInfo = options.viewportInfo;
    this.colors = options.colors;
    this.volumeSegments = options.volumeSegments;
    this.baselineNormalizedY = options.baselineNormalizedY;
    this.erasePreviewRanges = options.erasePreviewRanges;
    this.feedbackRange = options.feedbackRange;
    this.editPosition = options.editPosition;
    this.stage = new PIXI.Container();
    this.zeroLineGraphics = new PIXI.Graphics();
    this.areaGraphics = new PIXI.Graphics();
    this.erasePreviewGraphics = new PIXI.Graphics();
    this.effectiveVolumeLine = new VolumeLine({
      color: options.colors.line,
      width: VOLUME_EDITOR_LINE_WIDTH.volume,
      isVisible: true,
    });
    this.volumeFeedbackLine = new VolumeLine({
      color: options.colors.feedback,
      width: VOLUME_EDITOR_LINE_WIDTH.hoveredVolume,
      isVisible: false,
    });
    this.endpointsGraphics = new PIXI.Graphics();
    this.editPositionGraphics = new PIXI.Graphics();

    this.stage.addChild(this.zeroLineGraphics);
    this.stage.addChild(this.areaGraphics);
    this.stage.addChild(this.erasePreviewGraphics);
    this.stage.addChild(this.effectiveVolumeLine.container);
    this.stage.addChild(this.volumeFeedbackLine.container);
    this.stage.addChild(this.endpointsGraphics);
    this.stage.addChild(this.editPositionGraphics);

    const renderIfNeeded = () => {
      if (this.dirtyLayers.size > 0) {
        this.render();
      }
      this.requestId = window.requestAnimationFrame(renderIfNeeded);
    };
    this.requestId = window.requestAnimationFrame(renderIfNeeded);
  }

  updateViewportInfo(viewportInfo: ViewportInfo) {
    this.viewportInfo = viewportInfo;
    this.markDirty(VOLUME_EDITOR_LAYERS);
  }

  resize(width: number, height: number) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this.renderer.resize(width, height);
    this.markDirty(VOLUME_EDITOR_LAYERS);
    // キャンバスの寸法を変えると描いた内容が消えるので、空のまま表示されないようにすぐ描き直す
    this.render();
  }

  updateColors(colors: VolumeEditorColors) {
    this.colors = colors;
    this.markDirty(VOLUME_EDITOR_LAYERS);
  }

  updateVolumeSegments(volumeSegments: VolumeSegment[]) {
    this.volumeSegments = volumeSegments;
    this.markDirty([
      "area",
      "effectiveVolumeLine",
      "volumeFeedbackLine",
      "endpoints",
    ]);
  }

  updateBaselineNormalizedY(baselineNormalizedY: number) {
    this.baselineNormalizedY = baselineNormalizedY;
    this.markDirty(["zeroLine", "area"]);
  }

  updateErasePreviewRanges(
    erasePreviewRanges: readonly VolumeEditorBaseXRange[],
  ) {
    this.erasePreviewRanges = erasePreviewRanges;
    this.markDirty(["erasePreview"]);
  }

  /** 端点の色も強調によって変わるので、端点も描き直す。 */
  updateFeedbackRange(feedbackRange: VolumeEditorBaseXRange | undefined) {
    this.feedbackRange = feedbackRange;
    this.markDirty(["volumeFeedbackLine", "endpoints"]);
  }

  updateEditPosition(editPosition: VolumeEditPosition | undefined) {
    this.editPosition = editPosition;
    this.markDirty(["editPosition"]);
  }

  private markDirty(layers: readonly VolumeEditorLayer[]) {
    for (const layer of layers) {
      this.dirtyLayers.add(layer);
    }
  }

  private get viewInfo(): VolumeViewInfo {
    return {
      viewportWidth: this.canvasWidth,
      viewportHeight: this.canvasHeight,
      zoomX: this.viewportInfo.scaleX,
      offsetX: this.viewportInfo.offsetX,
      leftPadding: VOLUME_EDITOR_LAYOUT.keyColumnWidthPx,
    };
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
    this.zeroLineGraphics.destroy();
    this.areaGraphics.destroy();
    this.endpointsGraphics.destroy();
    this.erasePreviewGraphics.destroy();
    this.editPositionGraphics.destroy();
    this.stage.destroy();
    this.renderer.destroy({ removeView: true });
  }

  private render() {
    if (this.destroyed) {
      return;
    }
    for (const layer of this.dirtyLayers) {
      this.renderLayer(layer);
    }
    this.dirtyLayers.clear();
    this.renderer.render(this.stage);
  }

  private renderLayer(layer: VolumeEditorLayer) {
    switch (layer) {
      case "zeroLine":
        this.renderZeroLine();
        break;
      case "area":
        this.renderArea();
        break;
      case "erasePreview":
        this.renderErasePreview();
        break;
      case "effectiveVolumeLine":
        this.renderEffectiveVolumeLine();
        break;
      case "volumeFeedbackLine":
        this.renderVolumeFeedbackLine();
        break;
      case "endpoints":
        this.renderEndpoints();
        break;
      case "editPosition":
        this.renderEditPosition();
        break;
      default:
        throw new ExhaustiveError(layer);
    }
  }

  private renderEffectiveVolumeLine() {
    this.effectiveVolumeLine.color = this.colors.line;
    this.effectiveVolumeLine.update(this.volumeSegments, this.viewInfo);
  }

  private renderVolumeFeedbackLine() {
    const feedbackSegments = filterVolumeSegmentsByBaseXRange(
      this.volumeSegments,
      this.feedbackRange,
    );
    this.volumeFeedbackLine.color = this.colors.feedback;
    this.volumeFeedbackLine.isVisible = feedbackSegments.length > 0;
    this.volumeFeedbackLine.update(feedbackSegments, this.viewInfo);
  }

  private renderZeroLine() {
    this.zeroLineGraphics.clear();
    const { viewInfo, colors } = this;
    const y = volumeNormalizedYToScreenY(
      this.baselineNormalizedY,
      viewInfo.viewportHeight,
    );
    const { zeroLineDashPx, zeroLineGapPx } = VOLUME_EDITOR_LAYOUT;
    // PIXIのGraphicsには破線の指定がないので、短い線分を並べて描く
    for (
      let x = viewInfo.leftPadding;
      x < viewInfo.viewportWidth;
      x += zeroLineDashPx + zeroLineGapPx
    ) {
      this.zeroLineGraphics
        .moveTo(x, y)
        .lineTo(Math.min(x + zeroLineDashPx, viewInfo.viewportWidth), y);
    }
    this.zeroLineGraphics.stroke({
      width: VOLUME_EDITOR_LINE_WIDTH.zeroLine,
      color: colors.zeroLine.toRgbNumber(),
      alpha: colors.zeroLine.toAlphaFloat(),
    });
  }

  private renderArea() {
    this.areaGraphics.clear();
    const { viewInfo, colors } = this;
    const baseline = this.baselineNormalizedY;
    const baselineY = volumeNormalizedYToScreenY(
      baseline,
      viewInfo.viewportHeight,
    );
    const fill = {
      color: colors.areaContainer.toRgbNumber(),
      alpha: colors.areaContainer.toAlphaFloat(),
    };
    for (const segment of this.volumeSegments) {
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

  private renderEndpoints() {
    this.endpointsGraphics.clear();
    const { colors } = this;
    for (const node of buildVolumeEndpointNodes(
      this.volumeSegments,
      this.viewInfo,
    )) {
      const color = isVolumeEndpointInFeedbackRange(node, this.feedbackRange)
        ? colors.feedback
        : colors.line;
      this.endpointsGraphics
        .circle(node.x, node.y, VOLUME_EDITOR_LAYOUT.endpointRadiusPx)
        .fill({
          color: color.toRgbNumber(),
          alpha: color.toAlphaFloat(),
        });
    }
  }

  private renderErasePreview() {
    this.erasePreviewGraphics.clear();
    const { viewInfo, colors } = this;
    for (const range of this.erasePreviewRanges) {
      if (range.endBaseX <= range.startBaseX) {
        continue;
      }
      const startX = volumeBaseXToScreenX(range.startBaseX, viewInfo);
      const endX = volumeBaseXToScreenX(range.endBaseX, viewInfo);
      const clampedStart = Math.max(0, startX);
      const clampedEnd = Math.min(viewInfo.viewportWidth, endX);
      if (clampedEnd <= clampedStart) {
        continue;
      }
      this.erasePreviewGraphics
        .rect(
          clampedStart,
          0,
          clampedEnd - clampedStart,
          viewInfo.viewportHeight,
        )
        .fill({
          color: colors.erasePreviewOverlay.toRgbNumber(),
          alpha: colors.erasePreviewOverlay.toAlphaFloat(),
        });
    }
  }

  private renderEditPosition() {
    this.editPositionGraphics.clear();
    const editPosition = this.editPosition;
    if (editPosition == undefined) {
      return;
    }
    const { viewInfo, colors } = this;
    const x = volumeBaseXToScreenX(editPosition.baseX, viewInfo);
    const y = volumeNormalizedYToScreenY(
      editPosition.normalizedY,
      viewInfo.viewportHeight,
    );
    if (editPosition.showGuides) {
      // 1pxの線を画素の境目に揃えてにじませない。拍線と同じ位置合わせにする
      const guideX = Math.round(x) - 0.5;
      const guideY = Math.round(y) - 0.5;
      this.editPositionGraphics
        .moveTo(guideX, 0)
        .lineTo(guideX, guideY)
        .moveTo(viewInfo.leftPadding, guideY)
        .lineTo(viewInfo.viewportWidth, guideY)
        .stroke({
          width: VOLUME_EDITOR_LINE_WIDTH.guide,
          color: colors.guide.toRgbNumber(),
          alpha: colors.guide.toAlphaFloat(),
        });
    }
    if (editPosition.showPoint) {
      const radius = VOLUME_EDITOR_LAYOUT.hoverPointRadiusPx;
      this.editPositionGraphics.circle(x, y, radius).fill({
        color: colors.hoverPoint.toRgbNumber(),
        alpha: colors.hoverPoint.toAlphaFloat(),
      });
    }
  }
}
