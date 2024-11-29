/** エンジンのURLを構成するパラメータ */
export type EngineUrlParams = {
  protocol: string; // `http:`など
  hostname: string; // `example.com`など
  port: string; // `50021`など。空文字列もありえる。
  pathname: string; // `/engine`など。空文字列もありえる。
};

/**
 * URLを構成するパラメータから、VOICEVOXエディタが初期から想定しているURL文字列を組み立てる。
 * pathnameが空文字の場合は末尾にスラッシュを付与しない、などがビルトインのURLクラスと異なる。
 */
export function createEngineUrl(params: EngineUrlParams) {
  const { protocol, hostname, port, pathname } = params;
  const url = new URL(`${protocol}//${hostname}`); // NOTE: URLを正規化する
  url.port = port;
  return `${url.origin}${pathname}`; // NOTE: URLインターフェースは"pathname"が空文字でも"/"を付けるので手動で結合する。
}
