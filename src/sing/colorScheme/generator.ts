import Color from "colorjs.io";
import { PaletteGenerator } from "./types";

// パレット生成関数
export const defaultGenerator: PaletteGenerator = (baseColor, type) => {
  try {
    const [, , baseH] = baseColor;
    const colors: Record<number, string> = {};

    let targetC: number, targetH: number;

    switch (type) {
      case "primary":
        targetC = 0.115;
        targetH = baseH;
        break;
      case "secondary":
        targetC = 0.115 / 3;
        targetH = baseH;
        break;
      case "tertiary":
        targetC = 0.115;
        targetH = (baseH + 120) % 360;
        break;
      case "neutral":
        targetC = 0.0;
        targetH = baseH;
        break;
      case "neutralVariant":
        targetC = 0.025;
        targetH = baseH;
        break;
      case "error":
        targetC = 0.115;
        targetH = baseH;
        break;
      default:
        throw new Error(`Invalid color type: ${type}`);
    }

    const lightnessPoints = [
      0, 0.04, 0.08, 0.12, 0.16, 0.2, 0.24, 0.28, 0.32, 0.36, 0.4, 0.44, 0.48,
      0.52, 0.56, 0.6, 0.64, 0.68, 0.72, 0.76, 0.8, 0.84, 0.88, 0.92, 0.94,
      0.96, 0.98, 0.99, 1,
    ];

    lightnessPoints.forEach((point) => {
      const l = point;
      const c = targetC;
      const h = targetH;
      colors[point] = new Color("oklch", [l, c, h]).toString();
    });

    return colors;
  } catch (error) {
    throw new Error(`Failed to generate color palette: ${error}`);
  }
};
