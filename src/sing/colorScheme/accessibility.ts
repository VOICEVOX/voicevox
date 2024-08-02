import Color from "colorjs.io";
import { CSSColorString } from "./types";

export const getContrastRatio = (
  color1str: CSSColorString,
  color2str: CSSColorString,
  format: "WCAG21" | "APCA" = "APCA",
) => {
  const color1 = new Color(color1str);
  const color2 = new Color(color2str);
  return color1.contrast(color2, format);
};
