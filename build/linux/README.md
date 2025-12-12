# Linux用インストーラー関連ファイル

## installer_linux.template.sh

インストーラー生成用のテンプレート。
[build.yml](../../.github/workflows/build.yml) でLinux用インストールスクリプトに変換してデプロイする。

## voicevox.xml

ファイルの関連付け用。インストーラーが使用します。
サードパーティパッケージを作成する場合は`/usr/share/mime/packages/voicevox.xml`に配置する。

## voicevox.desktop

アプリケーションランチャーへの登録用。
サードパーティパッケージを作成する場合は`/usr/share/applications/voicevox.desktop`に配置し、[icon-mac.png](../icons/icon-mac.png)を`/usr/share/pixmaps/voicevox.png`に配置する。