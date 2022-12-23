import { EngineInfo } from "../type/preload";

// EngineInfoを並び替える。
// デフォルトエンジン→追加エンジンの順に並び替える。
// もし両方のエンジンがデフォルトエンジン（または追加エンジン）であれば、uuidの昇順に並び替える。
export const sortEngineInfos = (engineInfos: EngineInfo[]) => {
  return engineInfos.sort((a, b) => {
    const isDefaultA = a.type === "default" ? 1 : 0;
    const isDefaultB = b.type === "default" ? 1 : 0;
    if (isDefaultA !== isDefaultB) {
      return isDefaultB - isDefaultA;
    }

    return a.uuid.localeCompare(b.uuid);
  });
};
