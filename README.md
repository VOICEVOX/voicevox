# VOICEVOX

## 環境構築

[.node-version](.node-version)に記載されているバージョンの Node.js をインストールしてください。
インストール後、次のコマンドを実行してください。

```
npm ci
```

## 実行

`.env.production`をコピーして`.env`を作成し、`ENGINE_PATH`に`voicevox_engine`があるパスを指定します。
とりあえず[製品版 VOICEVOX](https://voicevox.hiroshiba.jp/) のディレクトリのパスを指定すれば動きます。

```
npm run electron:serve
```

音声合成エンジンのリポジトリはこちらです https://github.com/Hiroshiba/voicevox_engine

## ビルド

```
npm run electron:build
```

## コードフォーマット

コードのフォーマットを整えます。プルリクエストを送る前に実行してください。

```
npm run fmt
```

## OpenAPI generator

音声合成エンジンが起動している状態で以下のコマンドを実行してください。

```bash
curl http://127.0.0.1:50021/openapi.json >openapi.json

$(npm bin)/openapi-generator-cli generate \
    -i openapi.json \
    -g typescript-fetch \
    -o src/openapi/ \
    --additional-properties=modelPropertyNaming=camelCase,supportsES6=true,withInterfaces=true,typescriptThreePlus=true

npm run lint
```

## ライセンス

LGPL v3 と、ソースコードの公開が不要な別ライセンスのデュアルライセンスです。
別ライセンスを取得したい場合は、ヒホ（twitter: [@hiho_karuta](https://twitter.com/hiho_karuta)）に求めてください。
