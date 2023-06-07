# VOICEVOX

[![releases](https://img.shields.io/github/v/release/VOICEVOX/voicevox?label=Release)](https://github.com/VOICEVOX/voicevox/releases)
[![build](https://github.com/VOICEVOX/voicevox/actions/workflows/build.yml/badge.svg)](https://github.com/VOICEVOX/voicevox/actions/workflows/build.yml)
[![test](https://github.com/VOICEVOX/voicevox/actions/workflows/test.yml/badge.svg)](https://github.com/VOICEVOX/voicevox/actions/workflows/test.yml)
[![Discord](https://img.shields.io/discord/879570910208733277?color=5865f2&label=&logo=discord&logoColor=ffffff)](https://discord.gg/WMwWetrzuh)

[VOICEVOX](https://voicevox.hiroshiba.jp/) のエディターです。

（エンジンは [VOICEVOX ENGINE](https://github.com/VOICEVOX/voicevox_engine/) 、
コアは [VOICEVOX CORE](https://github.com/VOICEVOX/voicevox_core/) 、
全体構成は [こちら](./docs/全体構成.md) に詳細があります。）

## ユーザーの方へ

こちらは開発用のページになります。利用方法に関しては[VOICEVOX 公式サイト](https://voicevox.hiroshiba.jp/) をご覧ください。

## 貢献者の方へ

VOICEVOX のエディタは Electron・TypeScript・Vue・Vuex などが活用されており、全体構成がわかりにくくなっています。  
[コードの歩き方](./docs/コードの歩き方.md)で構成を紹介しているので、開発の一助になれば幸いです。

Issue を解決するプルリクエストを作成される際は、別の方と同じ Issue に取り組むことを避けるため、
Issue 側で取り組み始めたことを伝えるか、最初に Draft プルリクエストを作成してください。

[VOICEVOX 非公式 Discord サーバー](https://discord.gg/WMwWetrzuh)にて、開発の議論や雑談を行っています。気軽にご参加ください。

### デザインガイドライン

[UX・UI デザインの方針](./docs/UX・UIデザインの方針.md)をご参照ください。

## 環境構築

[.node-version](.node-version) に記載されているバージョンの Node.js をインストールしてください。  
Node.js の管理ツール ([nvs](https://github.com/jasongin/nvs)や[Volta](https://volta.sh)など)を利用すると簡単にインストールでき、Node.js の自動切り替えもできます。

Node.js をインストール後、[このリポジトリ](https://github.com/VOICEVOX/voicevox.git) を
Fork して `git clone` し、次のコマンドを実行してください。

```bash
npm ci
```

## 実行

`.env.production`をコピーして`.env`を作成し、`DEFAULT_ENGINE_INFOS`内の`executionFilePath`に`voicevox_engine`のフルパスを指定します。

[製品版 VOICEVOX](https://voicevox.hiroshiba.jp/) のディレクトリのパスを指定すれば動きます。

Windows の場合でもパスの区切り文字は`\`ではなく`/`なのでご注意ください。

また、macOS 向けの`VOICEVOX.app`を利用している場合は`/path/to/VOICEVOX.app/Contents/MacOS/run`を指定してください。

Linux の場合は、[Releases](https://github.com/VOICEVOX/voicevox/releases/)から入手できる tar.gz 版に含まれる`run`コマンドを指定してください。
AppImage 版の場合は`$ /path/to/VOICEVOX.AppImage --appimage-mount`でファイルシステムをマウントできます。

VOICEVOX エディタの実行とは別にエンジン API のサーバを立てている場合は`executionFilePath`を指定する必要はありません。
これは製品版 VOICEVOX を起動している場合もあてはまります。

また、エンジン API の宛先エンドポイントを変更する場合は`DEFAULT_ENGINE_INFOS`内の`host`を変更してください。

```bash
npm run electron:serve
```

音声合成エンジンのリポジトリはこちらです <https://github.com/VOICEVOX/voicevox_engine>

## ビルド

```bash
npm run electron:build
```

## テスト

```bash
npm run test:unit
npm run test:e2e
```

### 監視モード

```bash
npm run test-watch:unit
npm run test-watch:e2e
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

## 型チェック

TypeScript の型チェックを行います。
※ 現在チェック方法は 2 種類ありますが、将来的に 1 つになります。

```bash
# .tsのみ型チェック
npm run typecheck

# .vueも含めて型チェック
# ※ 現状、大量にエラーが検出されます。
npm run typecheck:vue-tsc
```

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

npx openapi-generator-cli generate \
    -i openapi.json \
    -g typescript-fetch \
    -o src/openapi/ \
    --additional-properties "modelPropertyNaming=camelCase,supportsES6=true,withInterfaces=true,typescriptThreePlus=true"

npm run fmt
```

## VS Code でのデバッグ実行

npm scripts の `serve` や `electron:serve` などの開発ビルド下では、ビルドに使用している vite で sourcemap を出力するため、ソースコードと出力されたコードの対応付けが行われます。

`.vscode/launch.template.json` をコピーして `.vscode/launch.json` を作成することで、開発ビルドを VS Code から実行し、デバッグを可能にするタスクが有効になります。

## ライセンス

LGPL v3 と、ソースコードの公開が不要な別ライセンスのデュアルライセンスです。
別ライセンスを取得したい場合は、ヒホ（twitter: [@hiho_karuta](https://twitter.com/hiho_karuta)）に求めてください。
