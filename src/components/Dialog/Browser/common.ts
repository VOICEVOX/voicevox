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
      return "warning";
    case "warning":
    // TODO：用意する
    // fallthrough
    case "question":
    case "info":
    default:
      return "display";
  }
};
