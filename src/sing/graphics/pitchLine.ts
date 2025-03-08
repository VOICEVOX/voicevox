import { z } from "zod";
import * as PIXI from "pixi.js";
import { calculateHash, getLast } from "@/sing/utility";
import { Color, LineStrip } from "@/sing/graphics/lineStrip";

export type PitchData = {
  readonly baseX: number;
  readonly baseY: number;
}[];

const pitchDataHashSchema = z.string().brand<"PitchDataHash">();

export type PitchDataHash = z.infer<typeof pitchDataHashSchema>;

export const calculatePitchDataHash = async (pitchData: PitchData) => {
  const hash = await calculateHash(pitchData);
  return pitchDataHashSchema.parse(hash);
};

export type ViewInfo = {
  readonly viewportWidth: number;
  readonly zoomX: number;
  readonly zoomY: number;
  readonly offsetX: number;
  readonly offsetY: number;
};

/**
 * ピッチラインを描画するクラス。
 */
export class PitchLine {
  color: Color;
  width: number;
  isVisible: boolean;
  pitchDataMap: Map<PitchDataHash, PitchData>;

  private readonly lineStripMap: Map<PitchDataHash, LineStrip>;
  private readonly container: PIXI.Container;

  get displayObject(): PIXI.DisplayObject {
    return this.container;
  }

  constructor(color: Color, width: number, isVisible: boolean) {
    this.color = color;
    this.width = width;
    this.isVisible = isVisible;
    this.pitchDataMap = new Map();

    this.lineStripMap = new Map();
    this.container = new PIXI.Container();
  }

  /**
   * ピッチラインを更新する。（パラメーターの変更を適用する）
   */
  update(viewInfo: ViewInfo) {
    this.container.renderable = this.isVisible;
    if (!this.isVisible) {
      return;
    }

    const removedLineStrips: LineStrip[] = [];

    // 対応するピッチデータが無い場合、または色・幅が変わった場合に、LineStripを削除する
    for (const [key, lineStrip] of this.lineStripMap) {
      if (
        !this.pitchDataMap.has(key) ||
        !lineStrip.color.equals(this.color) ||
        lineStrip.width !== this.width
      ) {
        this.container.removeChild(lineStrip.displayObject);
        removedLineStrips.push(lineStrip);
        this.lineStripMap.delete(key);
      }
    }

    // ピッチデータに対応するLineStripが無かったら作成する
    for (const [key, pitchData] of this.pitchDataMap) {
      if (this.lineStripMap.has(key)) {
        continue;
      }

      // 再利用できるLineStripがあれば再利用し、なければLineStripを作成する
      let lineStrip = removedLineStrips.pop();
      if (
        lineStrip != undefined &&
        lineStrip.color.equals(this.color) &&
        lineStrip.width === this.width
      ) {
        lineStrip.numOfPoints = pitchData.length;
      } else {
        lineStrip = new LineStrip(pitchData.length, this.color, this.width);
      }

      this.container.addChild(lineStrip.displayObject);
      this.lineStripMap.set(key, lineStrip);
    }

    // 再利用されなかったLineStripは破棄する
    for (const lineStrip of removedLineStrips) {
      lineStrip.destroy();
    }

    // LineStripを更新
    for (const [key, pitchData] of this.pitchDataMap) {
      const lineStrip = this.lineStripMap.get(key);
      if (lineStrip == undefined) {
        throw new Error("lineStrip is undefined.");
      }

      // カリングを行う
      const startBaseX = pitchData[0].baseX;
      const lastBaseX = getLast(pitchData).baseX;
      const startX = startBaseX * viewInfo.zoomX - viewInfo.offsetX;
      const lastX = lastBaseX * viewInfo.zoomX - viewInfo.offsetX;
      if (startX >= viewInfo.viewportWidth || lastX <= 0) {
        lineStrip.renderable = false;
        continue;
      }
      lineStrip.renderable = true;

      // ポイントを計算してlineStripに設定＆更新
      for (let i = 0; i < pitchData.length; i++) {
        const baseX = pitchData[i].baseX;
        const baseY = pitchData[i].baseY;
        const x = baseX * viewInfo.zoomX - viewInfo.offsetX;
        const y = baseY * viewInfo.zoomY - viewInfo.offsetY;
        lineStrip.setPoint(i, x, y);
      }
      lineStrip.update();
    }
  }

  /**
   * 破棄する。
   */
  destroy() {
    this.lineStripMap.forEach((value) => value.destroy());
    this.lineStripMap.clear();
    this.container.destroy();
  }
}
