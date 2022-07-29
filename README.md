# VOICEVOX

[VOICEVOX](https://voicevox.hiroshiba.jp/) のエディターです。

（エンジンは [VOICEVOX ENGINE](https://github.com/VOICEVOX/voicevox_engine/) 、
コアは [VOICEVOX CORE](https://github.com/VOICEVOX/voicevox_core/) 、
全体構成は [こちら](./docs/全体構成.md) に詳細があります。）

## 環境構築

[.node-version](.node-version) に記載されているバージョンの Node.js をインストールしてください。
Node.js をインストール後、[このリポジトリ](https://github.com/VOICEVOX/voicevox.git) を
Fork して `git clone` し、次のコマンドを実行してください。

Node.js の管理ツール ([nvs](https://github.com/jasongin/nvs)など)を利用すると、
[.node-version](.node-version) を簡単にインストールすることができます。

```bash
npm ci
```

## 実行

`.env.production`をコピーして`.env`を作成し、`DEFAULT_ENGINE_INFOS`内の`executionFilePath`に`voicevox_engine`があるパスを指定します。
[製品版 VOICEVOX](https://voicevox.hiroshiba.jp/) のディレクトリのパスを指定すれば動きます。
Windowsの場合でもパスの区切り文字は`\`ではなく`/`なのでご注意ください。

```bash
npm run electron:serve
```

音声合成エンジンのリポジトリはこちらです <https://github.com/VOICEVOX/voicevox_engine>

## 貢献者の方へ

Issue を解決するプルリクエストを作成される際は、別の方と同じ Issue に取り組むことを避けるため、
Issue 側で取り組み始めたことを伝えるか、最初に Draft プルリクエストを作成してください。

## ビルド

```bash
npm run electron:build
```

## テスト

```bash
npm run test:unit
npm run test:e2e
```

## 依存ライブラリのライセンス情報の生成

```bash
# get licenses.json from voicevox_engine as engine_licenses.json

npm run license:generate -- -o voicevox_licenses.json
npm run license:merge -- -o public/licenses.json -i engine_licenses.json -i voicevox_licenses.json
```

## コードフォーマット

コードのフォーマットを整えます。プルリクエストを送る前に実行してください。

```bash
npm run fmt
```

## タイポチェック

[typos](https://github.com/crate-ci/typos) を使ってタイポのチェックを行っています。
[typos をインストール](https://github.com/crate-ci/typos#install) した後

```bash
typos
```

でタイポチェックを行えます。
もし誤判定やチェックから除外すべきファイルがあれば
[設定ファイルの説明](https://github.com/crate-ci/typos#false-positives) に従って`_typos.toml`を編集してください。

## Markdownlint

Markdown の文法チェックを行います。

```bash
npm run markdownlint
```

## Shellcheck

ShellScript の文法チェックを行います。
インストール方法は [こちら](https://github.com/koalaman/shellcheck#installing) を参照してください。

```bash
shellcheck ./build/*.sh
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

npm run fmt
```

## ライセンス

LGPL v3 と、ソースコードの公開が不要な別ライセンスのデュアルライセンスです。
別ライセンスを取得したい場合は、ヒホ（twitter: [@hiho_karuta](https://twitter.com/hiho_karuta)）に求めてください。
