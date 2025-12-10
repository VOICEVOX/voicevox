# Linux用インストーラー関連ファイル

## installer_linux.template.sh

インストーラー生成用のテンプレート。
[build.yml](../../.github/workflows/build.yml) でLinux用インストールスクリプトに変換してデプロイする。

## voicevox.xml

ファイルの関連付け用。インストーラーが使用します。
サードパーティパッケージを作成する場合は`/usr/share/mime/packages/voicevox.xml`に配置する。
