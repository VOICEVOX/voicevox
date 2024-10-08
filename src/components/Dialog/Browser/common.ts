export const getIcon = (dialogType: string) => {
  switch (dialogType) {
    case "info":
      return "info";
    case "error":
      return "error";
    case "question":
      return "help";
    case "warning":
      return "warning";
    default:
      return "";
  }
};

export const getColor = (dialogType: string) => {
  switch (dialogType) {
    case "error":
    case "warning":
      // TODO：warning用の色を用意する
      return "warning";
    case "question":
    case "info":
    default:
      return "display";
  }
};
