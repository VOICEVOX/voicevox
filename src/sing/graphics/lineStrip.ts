import * as PIXI from "pixi.js";
import lineStripVertexShaderSource from "@/sing/graphics/shaders/lineStripVertexShader.glsl?raw";
import fragmentShaderSource from "@/sing/graphics/shaders/fragmentShader.glsl?raw";

/**
 * 色を表します。各値は0以上255以下です。
 */
export class Color {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;

  constructor(r: number, g: number, b: number, a: number) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  equals(color: Color) {
    return (
      this.r === color.r &&
      this.g === color.g &&
      this.b === color.b &&
      this.a === color.a
    );
  }

  toRgbaArray() {
    return [this.r, this.g, this.b, this.a];
  }
}

/**
 * 複数のポイントから折れ線を引きます。
 */
export class LineStrip {
  readonly color: Color;
  readonly width: number;
  private readonly mesh: PIXI.Mesh<PIXI.Shader>;
  private readonly shader: PIXI.Shader;
  private readonly geometry: PIXI.Geometry;
  private readonly pointsBuffer: PIXI.Buffer;

  private points: Float32Array;

  get displayObject() {
    return this.mesh as PIXI.DisplayObject;
  }

  get renderable() {
    return this.mesh.renderable;
  }
  set renderable(value: boolean) {
    this.mesh.renderable = value;
  }

  get numOfPoints() {
    return this.points.length / 2;
  }
  set numOfPoints(value: number) {
    if (value < 2) {
      throw new Error("The number of points must be at least 2.");
    }
    this.points = new Float32Array(value * 2);
  }

  /**
   * @param numOfPoints ポイントの数
   * @param color 線の色（RGBA）
   * @param width 線の幅（px）
   */
  constructor(numOfPoints: number, color: Color, width: number) {
    if (numOfPoints < 2) {
      throw new Error("The number of points must be at least 2.");
    }
    this.color = color;
    this.width = width;
    this.shader = PIXI.Shader.from(
      lineStripVertexShaderSource,
      fragmentShaderSource,
      { color: color.toRgbaArray().map((value) => value / 255) },
    );
    this.points = new Float32Array(numOfPoints * 2);
    this.pointsBuffer = new PIXI.Buffer(this.points, false);
    const vertices = this.generateLineSegmentVertices(width);
    const sizeOfFloat = 4;
    this.geometry = new PIXI.Geometry();
    this.geometry.instanced = true;
    this.geometry.instanceCount = numOfPoints - 1;
    this.geometry.addAttribute("pos", vertices.flat(), 3);
    this.geometry.addAttribute(
      "pointA",
      this.pointsBuffer,
      2,
      false,
      PIXI.TYPES.FLOAT,
      sizeOfFloat * 2,
      0,
      true,
    );
    this.geometry.addAttribute(
      "pointB",
      this.pointsBuffer,
      2,
      false,
      PIXI.TYPES.FLOAT,
      sizeOfFloat * 2,
      sizeOfFloat * 2,
      true,
    );
    this.mesh = new PIXI.Mesh(this.geometry, this.shader);
  }

  private generateLineSegmentVertices(width: number) {
    const halfWidth = width / 2;
    return [
      [-halfWidth, -halfWidth, 0],
      [halfWidth, -halfWidth, 1],
      [halfWidth, halfWidth, 1],
      [-halfWidth, -halfWidth, 0],
      [halfWidth, halfWidth, 1],
      [-halfWidth, halfWidth, 0],
    ];
  }

  /**
   * ポイントを設定します。設定し終わったら`update()`を呼んでください。
   */
  setPoint(index: number, x: number, y: number) {
    this.points[2 * index] = x;
    this.points[2 * index + 1] = y;
  }

  /**
   * 折れ線を更新します。（設定されたポイントを適用します）
   */
  update() {
    this.pointsBuffer.update(this.points);
    if (this.geometry.instanceCount !== this.numOfPoints - 1) {
      this.geometry.instanceCount = this.numOfPoints - 1;
    }
  }

  /**
   * 破棄します。
   */
  destroy() {
    this.mesh.destroy();
    this.geometry.destroy();
    this.shader.destroy();
    this.pointsBuffer.destroy();
  }
}
