import { ExhaustiveError } from "@/type/utility";

export type DialogType = "info" | "error" | "question" | "warning";

export const getIcon = (dialogType: DialogType) => {
  switch (dialogType) {
    case "error":
      return "error";
    case "question":
      return "help";
    case "warning":
      return "warning";
    case "info":
      throw new Error("infoはアイコンなし");
    default:
      throw new ExhaustiveError(dialogType);
  }
};

export const getColor = (dialogType: DialogType) => {
  switch (dialogType) {
    case "error":
      return "warning";
    case "warning":
      return "yellow-9"; // TODO: warning用の色をちゃんと用意する
    case "question":
    case "info":
      return "display";
    default:
      throw new ExhaustiveError(dialogType);
  }
};
