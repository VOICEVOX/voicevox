# Linux用インストーラー関連ファイル

## installer_linux.template.sh

インストーラー生成用のテンプレート。
https://github.com/VOICEVOX/voicevox/blob/main/.github/workflows/build.yml でinstaller_linux.shに変換してアップロードする。

## voicevox.xml

ファイルの関連付け用。インストーラーが使用します。
サードパーティパッケージを作成する場合は`/usr/share/mime/packages/voicevox.xml`に配置する。
