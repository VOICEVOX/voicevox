; エンジンを同梱しない Windows インストーラー用の NSIS スクリプト
; electron-builder の標準ダウンロード処理を使い、完了画面を省略してアプリを自動起動する
!define VOICEVOX_DOWNLOAD_INSTALLER
!ifndef BUILD_UNINSTALLER
!define VOICEVOX_AUTO_START_APP

!macro customFinishPage
!macroend

AutoCloseWindow true
!endif

!include "${__FILEDIR__}\installer.nsh"
