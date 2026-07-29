import * as PIXI from "pixi.js";
import { Color } from "@/sing/graphics/lineStrip";

export type VolumePoint = {
  readonly baseX: number;
  readonly normalizedY: number;
};

export type VolumeSegment = VolumePoint[];

export type VolumeViewInfo = {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly zoomX: number;
  readonly offsetX: number;
  readonly leftPadding: number;
};

export const volumeNormalizedYToScreenY = (
  normalizedY: number,
  viewportHeight: number,
) => (1 - normalizedY) * viewportHeight;

export const findFirstVolumePointAtOrAfter = (
  segment: VolumeSegment,
  targetBaseX: number,
) => {
  let low = 0;
  let high = segment.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (segment[middle].baseX < targetBaseX) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

export const findFirstVolumePointAfter = (
  segment: VolumeSegment,
  targetBaseX: number,
) => {
  let low = 0;
  let high = segment.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (segment[middle].baseX <= targetBaseX) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
};

type VolumeLineOptions = {
  color: Color;
  width: number;
  isVisible?: boolean;
};

/**
 * ボリュームラインを描画するクラス。
 */
export class VolumeLine {
  color: Color;
  width: number;
  isVisible: boolean;

  readonly container: PIXI.Container;
  private readonly line: PIXI.Graphics;

  constructor(options: VolumeLineOptions) {
    this.color = options.color;
    this.width = options.width;
    this.isVisible = options.isVisible ?? true;

    this.container = new PIXI.Container();
    this.line = new PIXI.Graphics();

    this.container.addChild(this.line);
  }

  update(segments: VolumeSegment[], viewInfo: VolumeViewInfo) {
    this.container.renderable = this.isVisible;
    if (!this.isVisible) {
      return;
    }
    const alpha = this.color.a / 255;

    this.line.clear();

    const strokeStyle = {
      width: this.width,
      color: this.color.toRgbNumber(),
      alpha,
      alignment: 0.5,
    };

    for (const segment of segments) {
      if (segment.length < 2) continue;

      const firstPoint = segment[0];
      const lastPoint = segment[segment.length - 1];
      const firstX =
        firstPoint.baseX * viewInfo.zoomX -
        viewInfo.offsetX +
        viewInfo.leftPadding;
      const lastX =
        lastPoint.baseX * viewInfo.zoomX -
        viewInfo.offsetX +
        viewInfo.leftPadding;
      if (firstX >= viewInfo.viewportWidth || lastX <= 0) {
        continue;
      }

      const viewportStartBaseX =
        (viewInfo.offsetX - viewInfo.leftPadding) / viewInfo.zoomX;
      const viewportEndBaseX =
        (viewInfo.offsetX + viewInfo.viewportWidth - viewInfo.leftPadding) /
        viewInfo.zoomX;
      const startIndex = Math.max(
        0,
        findFirstVolumePointAtOrAfter(segment, viewportStartBaseX) - 1,
      );
      const endIndex = Math.min(
        segment.length,
        findFirstVolumePointAtOrAfter(segment, viewportEndBaseX) + 1,
      );

      // 画面座標に変換
      const screenPoints = segment.slice(startIndex, endIndex).map((point) => ({
        x:
          point.baseX * viewInfo.zoomX -
          viewInfo.offsetX +
          viewInfo.leftPadding,
        y: volumeNormalizedYToScreenY(
          point.normalizedY,
          viewInfo.viewportHeight,
        ),
      }));

      this.line.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 1; i < screenPoints.length; i++) {
        this.line.lineTo(screenPoints[i].x, screenPoints[i].y);
      }
    }

    this.line.stroke(strokeStyle);
  }

  destroy() {
    this.line.destroy();
    this.container.destroy();
  }
}
