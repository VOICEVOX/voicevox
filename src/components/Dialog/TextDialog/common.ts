import { ExhaustiveError } from "@/type/utility";

export type DialogType = "none" | "info" | "error" | "question" | "warning";
export const getIcon = (dialogType: DialogType) => {
  switch (dialogType) {
    case "info":
      return "info";
    case "error":
      return "error";
    case "question":
      return "help";
    case "warning":
      return "warning";
    case "none":
      return "";
    default:
      throw new ExhaustiveError(dialogType);
  }
};

export const getColor = (dialogType: DialogType) => {
  switch (dialogType) {
    case "error":
    case "warning":
      // TODO：warning用の色を用意する
      return "warning";
    case "question":
    case "info":
    case "none":
      return "display";
    default:
      throw new ExhaustiveError(dialogType);
  }
};
