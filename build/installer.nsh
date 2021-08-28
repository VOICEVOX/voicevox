!include "LogicLib.nsh"
!include "FileFunc.nsh"

!macro defineVariables
    ; define download url
    !define DOWNLOAD_URL "https://github.com/Hiroshiba/voicevox/releases/download/${VERSION}"

    ; 12GB (Installer: 2.7GB x2, VOICEVOX: 5.7GB)
    !define SPACENEEDED 12
!macroend

!macro checkDiskSpace
    Var /GLOBAL spaceAvailable

    ${GetRoot} "$INSTDIR" $0 ; get drive letter

    ${DriveSpace} "$0\" "/D=F /S=G" $spaceAvailable ; G = GiB

    MessageBox MB_OKCANCEL|MB_ICONQUESTION "VOICEVOX needs to have at least ${SPACENEEDED} GB of free space on your system drive to installation.$\r$\nSpace available: $spaceAvailable GB$\r$\nDo you want to install VOICEVOX?" IDOK next
    ; execute below process if selected "Cancel"
    Quit ; quit immediately

    ; execute below process if selected "OK"
    next:
    ${If} $spaceAvailable < ${SPACENEEDED}
        MessageBox MB_OK|MB_ICONEXCLAMATION "There is not enough free space to install VOICEVOX on your system drive.$\r$\nnSpace required: ${SPACENEEDED} GB$\r$\nSpace available: $spaceAvailable GB"
        Quit ; quit immediately
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
