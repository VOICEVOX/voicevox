!macro customInit
    ; define download url
    !define DOWNLOAD_URL "https://github.com/Hiroshiba/voicevox/releases/download/${VERSION}"

    ; download files
    download:
    inetc::get /POPUP "https://github.com/" /RESUME "" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.0" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.0" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.1" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.1" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.2" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.2" /END
    Pop $0
    ${if} $0 == "Cancelled"
        Quit
    ${endif}

    ; try without proxy
    ${if} $0 != "OK"
        inetc::get /NOPROXY /POPUP "https://github.com/" /RESUME "" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.0" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.0" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.1" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.1" "${DOWNLOAD_URL}/voicevox-${VERSION}-x64.nsis.7z.2" "$TEMP/voicevox-${VERSION}-x64.nsis.7z.2" /END
        Pop $0
    ${endif}

    ${if} $0 == "Cancelled"
        Quit
    ${endif}

    ${if} $0 != "OK"
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "Error happened downloading files. click OK to abort installation." IDRETRY download
        Quit
    ${endif}

    ; copy and concatenate files
    ExecWait '"$SYSDIR\cmd.exe" /C COPY /B "$TEMP\voicevox-${VERSION}-x64.nsis.7z.0" + "$TEMP\voicevox-${VERSION}-x64.nsis.7z.1" + "$TEMP\voicevox-${VERSION}-x64.nsis.7z.2" "$EXEDIR\voicevox-${VERSION}-x64.nsis.7z"' $0
    
    ${If} $0 != "0"
        MessageBox MB_OK|MB_ICONEXCLAMATION "Error happened concatenating files. Return value: $0"
        Quit
    ${EndIf}

    ; delete files in temp dir
    Delete "$TEMP\voicevox-${VERSION}-x64.nsis.7z.0"
    Delete "$TEMP\voicevox-${VERSION}-x64.nsis.7z.1"
    Delete "$TEMP\voicevox-${VERSION}-x64.nsis.7z.2"

!macroend
