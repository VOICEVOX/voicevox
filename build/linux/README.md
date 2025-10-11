# installer_linux.shから使うファイル

サードパーティパッケージから再利用しやすいように`linux_install.sh`分離されたファイルたち。

## voicevox.xml

ファイルの関連付け用。以下のどちらかに配置します:

`/usr/share/mime/packages`(システム用)

`~/.local/share/mime/packages` (手動インストール用