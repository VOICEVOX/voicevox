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
    ヒソヒソ: -9,
  },
  ずんだもん: {
    ノーマル: -2,
    あまあま: 0,
    ツンツン: -3,
    セクシー: 0,
    ヒソヒソ: -7,
    ヘロヘロ: -3,
    なみだめ: 6,
  },
  春日部つむぎ: {
    ノーマル: -2,
  },
  雨晴はう: {
    ノーマル: 0,
  },
  波音リツ: {
    ノーマル: -8,
    クイーン: -5,
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
  WhiteCUL: {
    ノーマル: -6,
    たのしい: -3,
    かなしい: -7,
    びえーん: 0,
  },
  後鬼: {
    "人間ver.": -7,
    "ぬいぐるみver.": -2,
  },
  "No.7": {
    ノーマル: -8,
    アナウンス: -10,
    読み聞かせ: -9,
  },
  ちび式じい: {
    ノーマル: -18,
  },
  櫻歌ミコ: {
    ノーマル: -6,
    第二形態: -12,
    ロリ: -7,
  },
  "小夜/SAYO": {
    ノーマル: -4,
  },
  ナースロボ＿タイプＴ: {
    ノーマル: -6,
    楽々: -3,
    恐怖: -4,
  },
  "†聖騎士 紅桜†": {
    ノーマル: -15,
  },
  雀松朱司: {
    ノーマル: -21,
  },
  麒ヶ島宗麟: {
    ノーマル: -17,
  },
  春歌ナナ: {
    ノーマル: -2,
  },
  猫使アル: {
    ノーマル: -8,
    おちつき: -9,
    うきうき: -7,
  },
  猫使ビィ: {
    ノーマル: -1,
    おちつき: -3,
  },
  中国うさぎ: {
    ノーマル: -8,
    おどろき: -4,
    こわがり: -2,
    へろへろ: -4,
  },
  栗田まろん: {
    ノーマル: -14,
  },
  あいえるたん: {
    ノーマル: -2,
  },
  満別花丸: {
    ノーマル: -4,
    元気: 2,
    ささやき: -33,
    ぶりっ子: 0,
    ボーイ: -10,
  },
  琴詠ニア: {
    ノーマル: -4,
  },
};

/**
 * 指定した歌手の音域調整量を取得するワークアラウンド。
 * ハミングの場合はマジックナンバーを使う。
 * 歌手の場合は0を返す。
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
