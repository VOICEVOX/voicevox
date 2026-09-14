!define VOICEVOX_DOWNLOAD_INSTALLER
!ifndef BUILD_UNINSTALLER
!define VOICEVOX_AUTO_START_APP

!macro customFinishPage
!macroend

AutoCloseWindow true
!endif

!include "${__FILEDIR__}\installer.nsh"
