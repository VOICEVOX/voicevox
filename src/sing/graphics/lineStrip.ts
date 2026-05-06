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
  private readonly mesh: PIXI.Mesh<PIXI.Geometry, PIXI.Shader>;
  private readonly shader: PIXI.Shader;
  private readonly geometry: PIXI.Geometry;
  private readonly pointsBuffer: PIXI.Buffer;

  private points: Float32Array;

  get container(): PIXI.Container {
    return this.mesh;
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
    this.shader = PIXI.Shader.from({
      gl: {
        vertex: lineStripVertexShaderSource,
        fragment: fragmentShaderSource,
      },
      resources: {
        uniforms: new PIXI.UniformGroup({
          uLineColor: {
            value: color.toRgbaArray().map((value) => value / 255),
            type: "vec4<f32>",
          },
        }),
      },
    });
    this.points = new Float32Array(numOfPoints * 2);
    this.pointsBuffer = new PIXI.Buffer({
      data: this.points,
      usage: PIXI.BufferUsage.VERTEX,
    });
    const vertices = this.generateLineSegmentVertices(width);
    const sizeOfFloat = 4;
    this.geometry = new PIXI.Geometry({
      instanceCount: numOfPoints - 1,
      attributes: {
        pos: {
          buffer: new PIXI.Buffer({
            data: new Float32Array(vertices.flat()),
            usage: PIXI.BufferUsage.VERTEX,
          }),
          format: "float32x3",
          stride: 3 * sizeOfFloat,
          offset: 0,
        },
        pointA: {
          buffer: this.pointsBuffer,
          format: "float32x2",
          stride: sizeOfFloat * 2,
          offset: 0,
          instance: true,
        },
        pointB: {
          buffer: this.pointsBuffer,
          format: "float32x2",
          stride: sizeOfFloat * 2,
          offset: sizeOfFloat * 2,
          instance: true,
        },
      },
    });
    this.mesh = new PIXI.Mesh({ geometry: this.geometry, shader: this.shader });
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
    this.pointsBuffer.data = this.points;
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
