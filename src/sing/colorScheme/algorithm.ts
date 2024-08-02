import {
  ColorAlgorithm,
  OklchColor,
  ColorRole,
  ColorSchemeConfig,
} from "./types";

/**
 * Lを相対明度Lrに変換する
 * @param L : number - 明度
 * @returns number - 相対明度
 */
export const LtoLr = (L: number): number => {
  if (L < 0 || L > 1) {
    throw new Error("L must be between 0 and 1");
  }
  const k1 = 0.206;
  const k2 = 0.03;
  const k3 = (1 + k2) / (1 + k1);
  return (k3 * L - k2 + Math.sqrt((k3 * L - k2) ** 2 + 4 * k1 * k3 * L)) / 2;
};

/**
 * デフォルトのカラー生成アルゴリズム
 * @param config : ColorSchemeConfig - カラースキーム設定
 * @param sourceColor : OklchColor - 基準となるOKLCHカラー
 * @param targetRole : ColorRole | string - ターゲットのロール
 * @param shade : number - 明度レベル
 * @returns OklchColor - 生成されたOKLCHカラー
 */
export const defaultAlgorithm: ColorAlgorithm = (
  config: ColorSchemeConfig,
  sourceColor: OklchColor,
  targetRole: ColorRole | string,
  shade: number,
): OklchColor => {
  // 入力値の検証
  if (shade < 0 || shade > 1) {
    throw new Error("Shade must be between 0 and 1");
  }
  if (!sourceColor || sourceColor.length !== 3) {
    throw new Error("Invalid sourceColor");
  }

  // OKLCHのL値を相対明度Lr値に変換
  const targetL = LtoLr(shade);
  const [, c, h] = sourceColor;
  let targetC: number;
  let targetH: number;
  const maxC = 0.37; // 最大chroma
  const minC = 0.115; // 最小chroma

  // プライマリカラーの処理
  if (targetRole === "primary") {
    targetC = Math.max(minC, c);
    targetH = h;
    return [targetL, targetC, targetH];
  }

  // カスタムカラーの処理
  const customColor = config.customColors?.find((cc) => cc.name === targetRole);
  if (customColor) {
    targetC = Math.min(c, maxC);
    targetH = h;
    return [targetL, targetC, targetH];
  }

  // 指定されたrefColorの処理
  if (config.roleColors[targetRole as ColorRole]) {
    targetC = Math.min(c, maxC);
    return [targetL, targetC, h];
  }

  // デフォルト値の処理
  const defaultC = Math.max(c, minC);

  switch (targetRole) {
    case "secondary":
      targetC = defaultC / 3;
      targetH = h;
      break;
    case "tertiary":
      targetC = defaultC;
      targetH = (h - 30 + 360) % 360;
      break;
    case "neutral":
      targetC = 0.0;
      targetH = h;
      break;
    case "neutralVariant":
      targetC = 0.01;
      targetH = h;
      break;
    case "error":
      targetC = Math.min(defaultC * 1.2, maxC);
      targetH = 30;
      break;
    default:
      targetC = defaultC;
      targetH = h;
  }

  return [targetL, targetC, targetH];
};

// 他のアルゴリズムを追加する場合はここに実装
export const customAlgorithm: ColorAlgorithm = (
  config: ColorSchemeConfig,
  sourceColor: OklchColor,
  targetRole: ColorRole | string,
  shade: number,
): OklchColor => {
  // customAlgorithmの実装
  // この例では単純化のためdefaultAlgorithmと同じ実装を使用
  return defaultAlgorithm(config, sourceColor, targetRole, shade);
};

export const algorithms: Record<string, ColorAlgorithm> = {
  default: defaultAlgorithm,
  // custom: customAlgorithm,
};
