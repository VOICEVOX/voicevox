import { CharacterInfo, DefaultStyleId, SpeakerId } from "@/type/preload";

/** 話者に対応するデフォルトスタイルを取得する */
export const getDefaultStyle = (
  speakerUuid: SpeakerId,
  characterInfos: CharacterInfo[],
  defaultStyleIds: DefaultStyleId[],
) => {
  // FIXME: 同一キャラが複数エンジンにまたがっているとき、順番が先のエンジンが必ず選択される
  const characterInfo = characterInfos.find(
    (info) => info.metas.speakerUuid === speakerUuid,
  );
  const defaultStyleId = defaultStyleIds.find(
    (x) => x.speakerUuid === speakerUuid,
  )?.defaultStyleId;

  const defaultStyle =
    characterInfo?.metas.styles.find(
      (style) => style.styleId === defaultStyleId,
    ) ?? characterInfo?.metas.styles[0]; // デフォルトのスタイルIDが見つからない場合stylesの先頭を選択する

  if (defaultStyle == undefined) throw new Error("defaultStyle == undefined");

  return defaultStyle;
};
