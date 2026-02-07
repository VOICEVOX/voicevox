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
  dashed?: boolean;
  // TODO: 見た目調整のための暫定オプション。
  // TODO: 調整完了後に isVisible / areaAlpha は削除し、必要最小限に整理する。
  showArea?: boolean;
  areaAlpha?: number;
  isVisible?: boolean;
};

const colorToHex = (color: Color) => {
  return (color.r << 16) + (color.g << 8) + color.b;
};

/**
 * ボリュームライン（折れ線と塗りつぶし）を描画するクラス。
 */
export class VolumeLine {
  color: Color;
  width: number;
  dashed: boolean;
  showArea: boolean;
  areaAlpha: number;
  isVisible: boolean;

  private readonly container: PIXI.Container;
  private readonly area: PIXI.Graphics;
  private readonly line: PIXI.Graphics;

  get displayObject(): PIXI.DisplayObject {
    return this.container;
  }

  constructor(options: VolumeLineOptions) {
    this.color = options.color;
    this.width = options.width;
    this.dashed = options.dashed ?? false;
    this.showArea = options.showArea ?? false;
    this.areaAlpha = options.areaAlpha ?? 0.15;
    this.isVisible = options.isVisible ?? true;

    this.container = new PIXI.Container();
    this.area = new PIXI.Graphics();
    this.line = new PIXI.Graphics();

    this.container.addChild(this.area);
    this.container.addChild(this.line);
  }

  update(segments: VolumeSegment[], viewInfo: VolumeViewInfo) {
    this.container.renderable = this.isVisible;
    if (!this.isVisible) {
      return;
    }
    const alpha = this.color.a / 255;

    this.area.clear();
    this.line.clear();
    this.line.lineStyle({
      width: this.width,
      color: colorToHex(this.color),
      alpha,
      alignment: 0.5,
    });

    for (const segment of segments) {
      if (segment.length < 2) continue;

      // 画面座標に変換
      const screenPoints = segment.map((point) => ({
        x:
          point.baseX * viewInfo.zoomX -
          viewInfo.offsetX +
          viewInfo.leftPadding,
        y: (1 - point.normalizedY) * viewInfo.viewportHeight,
      }));

      const firstX = screenPoints[0].x;
      const lastX = screenPoints[screenPoints.length - 1].x;
      if (firstX >= viewInfo.viewportWidth || lastX <= 0) {
        continue;
      }

      if (this.showArea) {
        this.area.beginFill(colorToHex(this.color), this.areaAlpha);
        this.area.moveTo(screenPoints[0].x, viewInfo.viewportHeight);
        for (const p of screenPoints) {
          this.area.lineTo(p.x, p.y);
        }
        this.area.lineTo(
          screenPoints[screenPoints.length - 1].x,
          viewInfo.viewportHeight,
        );
        this.area.endFill();
      }

      if (this.dashed) {
        const dashLength = 6;
        const gapLength = 4;
        let drawing = true;
        let remaining = dashLength;

        this.line.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          let x0 = screenPoints[i - 1].x;
          let y0 = screenPoints[i - 1].y;
          const x1 = screenPoints[i].x;
          const y1 = screenPoints[i].y;
          let segLen = Math.hypot(x1 - x0, y1 - y0);
          while (segLen > 0.0001) {
            const step = Math.min(segLen, remaining);
            const t = step / segLen;
            const nx = x0 + (x1 - x0) * t;
            const ny = y0 + (y1 - y0) * t;

            if (drawing) {
              this.line.lineTo(nx, ny);
            } else {
              this.line.moveTo(nx, ny);
            }

            segLen -= step;
            remaining -= step;
            x0 = nx;
            y0 = ny;

            if (drawing && remaining <= 0) {
              drawing = false;
              remaining = gapLength;
            } else if (!drawing && remaining <= 0) {
              drawing = true;
              remaining = dashLength;
            }
          }
        }
      } else {
        this.line.moveTo(screenPoints[0].x, screenPoints[0].y);
        for (let i = 1; i < screenPoints.length; i++) {
          this.line.lineTo(screenPoints[i].x, screenPoints[i].y);
        }
      }
    }
  }

  destroy() {
    this.area.destroy();
    this.line.destroy();
    this.container.destroy();
  }
}
