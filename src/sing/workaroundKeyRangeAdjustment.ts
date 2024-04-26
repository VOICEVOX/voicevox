/**
 * 音域調整量の自動入力のためのワークアラウンド。
 * 本来エンジンから得るべき音域調整量を、マジックナンバーとして直接データ化している。
 *
 * FIXME: スタイルの音域をエンジンから取得可能にし、音域調整量を計算するように修正する。
 */

import { createLogger } from "@/domain/frontend/log";
import { Singer } from "@/store/type";
import { CharacterInfo, EngineId } from "@/type/preload";

const logger = createLogger("sing/workaroundKeyRangeAdjustment");

const workaroundKeyRangeAdjustmentValues: {
  [key: string]: { [key: string]: number };
} = {
  四国めたん: {
    ノーマル: -4,
    あまあま: -4,
    ツンツン: -5,
    セクシー: -4,
  },
  ずんだもん: {
    ノーマル: -2,
    あまあま: 0,
    ツンツン: -3,
    セクシー: 0,
  },
  春日部つむぎ: {
    ノーマル: -2,
  },
  雨晴はう: {
    ノーマル: 0,
  },
  波音リツ: {
    ノーマル: -8,
  },
  玄野武宏: {
    ノーマル: -17,
    喜び: -9,
    ツンギレ: -14,
    悲しみ: -18,
  },
  白上虎太郎: {
    ふつう: -14,
    わーい: -8,
    びくびく: -7,
    おこ: -9,
    びえーん: -3,
  },
  青山龍星: {
    ノーマル: -22,
    熱血: -18,
    不機嫌: -23,
    喜び: -21,
    しっとり: -27,
    かなしみ: -22,
  },
  冥鳴ひまり: {
    ノーマル: -7,
  },
  九州そら: {
    ノーマル: -7,
    あまあま: -2,
    ツンツン: -6,
    セクシー: -4,
  },
  もち子さん: {
    ノーマル: -5,
    "セクシー／あん子": -7,
    泣き: -2,
    怒り: -3,
    喜び: -2,
    のんびり: -5,
  },
  剣崎雌雄: {
    ノーマル: -18,
  },
};

/**
 * 指定した歌手の音域調整量を取得するワークアラウンド。
 */
export function getWorkaroundKeyRangeAdjustment(
  engineCharacterInfos: Record<EngineId, CharacterInfo[]>,
  singer: Singer,
): number {
  const defaultKeyRangeAdjustment = 0;

  const characterInfos = engineCharacterInfos[singer.engineId];
  if (characterInfos == undefined) {
    logger.warn("characterInfos not found.", singer);
    return defaultKeyRangeAdjustment;
  }
  const characterInfo = characterInfos.find((c) =>
    c.metas.styles.find((s) => s.styleId === singer.styleId),
  );
  if (characterInfo == undefined) {
    logger.warn("characterInfo not found.", singer);
    return defaultKeyRangeAdjustment;
  }
  const styleInfo = characterInfo.metas.styles.find(
    (s) => s.styleId === singer.styleId,
  );
  if (styleInfo == undefined) {
    logger.warn("styleInfo not found.", singer);
    return defaultKeyRangeAdjustment;
  }

  if (styleInfo.styleType == "frame_decode") {
    // ハミングの場合はマジックナンバーを使う
    const singerName = characterInfo.metas.speakerName;
    const styleName = styleInfo.styleName;
    if (styleName == undefined) {
      logger.warn("styleName not found.", singer);
      return defaultKeyRangeAdjustment;
    }
    const keyRangeAdjustment =
      workaroundKeyRangeAdjustmentValues[singerName]?.[styleName];
    if (keyRangeAdjustment == undefined) {
      // 新しいキャラなどの場合はここに来る
      logger.warn("keyRangeAdjustment not found.", singer);
      return defaultKeyRangeAdjustment;
    }
    return keyRangeAdjustment;
  } else {
    // 歌手の場合はそのまま
    return 0;
  }
}
