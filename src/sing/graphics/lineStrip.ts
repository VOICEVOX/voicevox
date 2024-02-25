import * as PIXI from "pixi.js";
import lineStripVertexShaderSource from "@/sing/graphics/shaders/lineStripVertexShader.glsl?raw";
import fragmentShaderSource from "@/sing/graphics/shaders/fragmentShader.glsl?raw";

/**
 * 複数の点から折れ線を引きます。点の数は途中で変更できません。
 */
export class LineStrip {
  private readonly mesh: PIXI.Mesh<PIXI.Shader>;
  private readonly shader: PIXI.Shader;
  private readonly geometry: PIXI.Geometry;
  private readonly points: Float32Array;
  private readonly pointsBuffer: PIXI.Buffer;

  get displayObject() {
    return this.mesh as PIXI.DisplayObject;
  }

  get renderable() {
    return this.mesh.renderable;
  }
  set renderable(value: boolean) {
    this.mesh.renderable = value;
  }

  /**
   * @param numOfPoints 点の数
   * @param color 線の色（RGBA）
   * @param width 線の幅（px）
   */
  constructor(numOfPoints: number, color: number[], width: number) {
    if (numOfPoints < 2) {
      throw new Error("The number of points must be at least 2.");
    }
    this.shader = PIXI.Shader.from(
      lineStripVertexShaderSource,
      fragmentShaderSource,
      { color }
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
      true
    );
    this.geometry.addAttribute(
      "pointB",
      this.pointsBuffer,
      2,
      false,
      PIXI.TYPES.FLOAT,
      sizeOfFloat * 2,
      sizeOfFloat * 2,
      true
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
   * 点の位置を設定します。設定し終わったら`update()`を呼んでください。
   */
  setPoint(index: number, x: number, y: number) {
    this.points[2 * index] = x;
    this.points[2 * index + 1] = y;
  }

  /**
   * 折れ線を更新します。（設定された点の位置を適用します）
   */
  update() {
    this.pointsBuffer.update(this.points);
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
