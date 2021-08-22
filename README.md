# VOICEVOX

## 環境構築

[.node-version](.node-version)に記載されているバージョンの Node.js をインストールしてください。
インストール後、次のコマンドを実行してください。

```bash
npm ci
```

## 実行

`.env.production`をコピーして`.env`を作成し、`ENGINE_PATH`に`voicevox_engine`があるパスを指定します。
とりあえず[製品版 VOICEVOX](https://voicevox.hiroshiba.jp/) のディレクトリのパスを指定すれば動きます。

```bash
npm run electron:serve
```

音声合成エンジンのリポジトリはこちらです <https://github.com/Hiroshiba/voicevox_engine>

## 貢献者の方へ

Issueを解決するプルリクエストを作成される際は、別の方と同じIssueに取り組むことを避けるため、
Issue側で取り組み始めたことを伝えるか、最初にDraftプルリクエストを作成してください。

## ビルド

```bash
npm run electron:build
```

## コードフォーマット

コードのフォーマットを整えます。プルリクエストを送る前に実行してください。

```bash
npm run fmt
```

## タイポチェック

[typos](https://github.com/crate-ci/typos)を使ってタイポのチェックを行っています。
[typosをインストール](https://github.com/crate-ci/typos#install)した後

```bash
typos
```

でタイポチェックを行えます。
もし誤判定やチェックから除外すべきファイルがあれば
[設定ファイルの説明](https://github.com/crate-ci/typos#false-positives)に従って``_typos.toml``を編集してください．

## Markdownlint

Markdownの文法チェックを行います。

```bash
npm run markdownlint
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
