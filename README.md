# VOICEVOX

## 環境構築

```
npm install
```

## 実行

`.env.production`をコピーして`.env`を作成し、`ENGINE_PATH`に`voicevox_engine`があるパスを指定します。
とりあえず製品版 VOICEVOX のディレクトリのパスを指定すれば動きます。

```
npm run electron:serve
```

音声合成エンジンのリポジトリはこちらです https://github.com/Hiroshiba/voicevox_engine

## ビルド

```
npm run electron:build
```

## Lint

```
npm run lint
```

## ライセンス

LGPL v3 と、ソースコードの公開が不要な別ライセンスのデュアルライセンスです。
別ライセンスを取得したい場合は、ヒホ（twitter: @hiho_karuta）に求めてください。
