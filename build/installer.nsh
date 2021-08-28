!include "LogicLib.nsh"
!include "FileFunc.nsh"

!macro defineVariables
    ; define download url
    !define DOWNLOAD_URL "https://github.com/Hiroshiba/voicevox/releases/download/${VERSION}"

    ; installer size (GB)
    !define VOICEVOX_DOWNLOAD_SIZE 2.7
    ; VOICEVOX size (GB)
    !define VOICEVOX_SIZE 5.7
    ; space required for installation (including installer x2 and vOICEVOX)
    ; because of NSIS specification, mathematic operation must be one operation at a command.
    ; ref. https://nsis.sourceforge.io/mediawiki/index.php?title=Reference/!define&oldid=23418
    !define /math VOICEVOX_DOWNLOAD_SIZE_DUBLE ${VOICEVOX_DOWNLOAD_SIZE} * 2
    !define /math INSTALL_SPACE_NEEDED ${VOICEVOX_DOWNLOAD_SIZE_DUBLE} + ${VOICEVOX_SIZE}
!macroend

!macro checkDiskSpace
    Var /GLOBAL spaceAvailable

    ${GetRoot} "$INSTDIR" $0 ; get drive letter

    ${DriveSpace} "$0\" "/D=F /S=G" $spaceAvailable ; G = GiB

    MessageBox MB_OKCANCEL|MB_ICONQUESTION "VOICEVOXをインストールするために ${VOICEVOX_DOWNLOAD_SIZE} GBのファイルをダウンロードします。$\r$\nインストールを続行しますか？" IDOK next
    ; execute below process if selected "Cancel"
    Quit ; quit immediately

    ; execute below process if selected "OK"
    next:
    ${If} $spaceAvailable < ${INSTALL_SPACE_NEEDED}
        MessageBox MB_YESNO|MB_ICONEXCLAMATION "インストール作業には ${INSTALL_SPACE_NEEDED} GBの空き容量が必要です。（空き容量：$spaceAvailable GB）$\r$\nインストールを中断しますか？" IDNO continue
        ; execute below process if select "YES"
        Quit ; quit immediately

        ; execute below process if selected "NO"
        continue:
    ${EndIf}
!macroend

; pre install process
!macro customInit
    !insertmacro defineVariables

    !insertmacro checkDiskSpace

    ; download files
    download:
    inetc::get /POPUP "https://github.com/" /RESUME "" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.0" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.0" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.1" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.1" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.2" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.2" /END
    Pop $0 ; return value("OK", "Cancelled" or else)

    ; download cancel handling
    ${if} $0 == "Cancelled"
        Quit ; quit immediately
    ${endif}

    ; try without proxy
    ${if} $0 != "OK"
        inetc::get /NOPROXY /POPUP "https://github.com/" /RESUME "" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.0" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.0" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.1" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.1" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.2" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.2" /END
        Pop $0 ; return value("OK", "Cancelled" or else)
    ${endif}

    ; download cancel handling
    ${if} $0 == "Cancelled"
        Quit ; quit immediately
    ${endif}

    ; download error handling
    ${if} $0 != "OK"
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Error happened downloading files." IDRETRY download
        Quit ; quit immediately
    ${endif}

    ; show preparing message banner
    Banner::show /set 76 "Preparing for installation" "please wait..."

    ; copy and concatenate files
    nsExec::ExecToStack '"$SYSDIR\cmd.exe" /C COPY /B "$TEMP\voicevox-${VERSION}-x64.nsis.7z.0" + "$TEMP\voicevox-${VERSION}-x64.nsis.7z.1" + "$TEMP\voicevox-${VERSION}-x64.nsis.7z.2" "$EXEDIR\voicevox-${VERSION}-x64.nsis.7z"'
    Pop $0 ; return value
    Pop $1 ; return message

    ; concatenation error handling
    ${If} $0 != "0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Error happened concatenating files. $1($0)"
        Quit ; quit immediately
    ${EndIf}

    ; delete files in temp dir
    Delete "$TEMP\voicevox-${VERSION}-x64.nsis.7z.0"
    Delete "$TEMP\voicevox-${VERSION}-x64.nsis.7z.1"
    Delete "$TEMP\voicevox-${VERSION}-x64.nsis.7z.2"

    ; destroy preparing message banner
    Banner::destroy
!macroend

; post install process
!macro customInstall
    ; delete file in installer dir
    Delete "$EXEDIR\voicevox-${VERSION}-x64.nsis.7z"
!macroend
