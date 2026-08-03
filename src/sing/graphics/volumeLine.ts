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

      // 画面座標に変換
      const screenPoints = segment.map((point) => ({
        x:
          point.baseX * viewInfo.zoomX -
          viewInfo.offsetX +
          viewInfo.leftPadding,
        y: (1 - point.normalizedY) * viewInfo.viewportHeight,
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
