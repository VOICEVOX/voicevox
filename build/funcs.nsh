!ifndef VOICEVOX_FUNCS_INCLUDED
!define VOICEVOX_FUNCS_INCLUDED

; このファイルには独自に定義した定数や変数には依存しない処理だけをまとめておく

!include "LogicLib.nsh"
!include "FileFunc.nsh"

; ${myQuitError} ExitCode
; インストーラーをエラー終了する
; エラーコード一覧は以下
; https://docs.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-
; @param ExitCode 終了コード、空を渡すと新しく設定しない
!define myQuitError "!insertmacro myQuitError"
!macro myQuitError ExitCode
  ; ここで終了するのでレジスターの内容を退避/復帰させなくてもいい
  StrCpy $0 "${ExitCode}"
  ${If} $0 != ""
    SetErrorLevel $0
  ${EndIf}
  Quit
!macroend

; ${myQuit}
; 後処理をしてインストーラーを終了する
; 終了コードは既に設定されているものを使用する
!define myQuit `!insertmacro myQuitError ""`

; ${myQuitSuccess}
; 後処理をしてインストーラーを正常終了する
!define myQuitSuccess "!insertmacro myQuitError 0"

; ${getArchiveNameAndHash} ResultPath ResultHash
; 結合済みのファイルについての情報を取得する
; @return ResultPath 結合済みファイルで使うべきファイル名
; @return ResultHash 結合済みファイルで期待される SHA2-512 でのハッシュ値（16進数大文字）
!define getArchiveNameAndHash "!insertmacro getArchiveNameAndHash"
!macro getArchiveNameAndHash ResultPath ResultHash
  Push $0 ; Stack $0
  Push $1 ;       $1 $0

  ; electron-builder のスクリプトに基づいたハッシュ値と対象ファイル名の取得
  ; https://github.com/electron-userland/electron-builder/blob/28cb86bdcb6dd0b10e75a69ccd34ece6cca1d204/packages/app-builder-lib/templates/nsis/include/installer.nsh#L17-L70
  !ifdef APP_64_NAME
    !ifdef APP_32_NAME
      !ifdef APP_ARM64_NAME
        ${if} ${IsNativeARM64}
          StrCpy $0 "${APP_ARM64_NAME}"
          StrCpy $1 "${APP_ARM64_HASH}"
        ${elseif} ${IsNativeAMD64}
          StrCpy $0 "${APP_64_NAME}"
          StrCpy $1 "${APP_64_HASH}"
        ${else}
          StrCpy $0 "${APP_32_NAME}"
          StrCpy $1 "${APP_32_HASH}"
        ${endif}
      !else
        ${if} ${RunningX64}
          StrCpy $0 "${APP_64_NAME}"
          StrCpy $1 "${APP_64_HASH}"
        ${else}
          StrCpy $0 "${APP_32_NAME}"
          StrCpy $1 "${APP_32_HASH}"
        ${endif}
      !endif
    !else
      StrCpy $0 "${APP_64_NAME}"
      StrCpy $1 "${APP_64_HASH}"
    !endif
  !else
    StrCpy $0 "${APP_32_NAME}"
    StrCpy $1 "${APP_32_HASH}"
  !endif

                      ; Stack $1 $0
  Exch $1             ;       <ResultHash> $0
  Exch                ;       $0 <ResultHash>
  Exch $0             ;       <ResultPath> <ResultHash>
  Pop "${ResultPath}" ;       <ResultHash>
  Pop "${ResultHash}" ;       -empty-
!macroend

; ${getFileSize} Result Path
; ファイルサイズを取得する
; ファイルへのアクセスに失敗した場合はエラーフラグが立つ
; @param Path ファイルへのパス
; @return Result ファイルサイズ（バイト）
!define getFileSize "!insertmacro getFileSize"
!macro getFileSize Result Path
  Push "${Path}" ; Stack <Path>
  Exch $0        ;       $0
  Push $1        ;       $1 $0

  ClearErrors
  FileOpen $1 $0 "r"
  ${IfNot} ${Errors}
    FileSeek $1 0 "END" $0
    FileClose $1
  ${Else}
    StrCpy $0 0
  ${EndIf}

                  ; Stack $1 $0
  Pop $1          ;       $0
  Exch $0         ;       <Result>
  Pop "${Result}" ;       -empty-
!macroend

; ${bytesToHumanReadable} Result Input
; バイト単位のサイズを人間が読みやすい表現に変換する
; @param Input バイト単位での容量
; @return Result "1.63 GB" などの人間が読みやすい表記での容量
!define bytesToHumanReadable "!insertmacro bytesToHumanReadable"
!macro bytesToHumanReadable Result Input
  Push "${Input}" ; Stack <Input>
  Exch $0         ;       $0
  Push $1         ;       $1 $0
  Push $2         ;       $2 $1 $0
  Push $3         ;       $3 $2 $1 $0

  StrCpy $3 0
  ${Do}
    StrLen $2 $0
    ${If} $2 > 3 ; 1000 以上あるか？
      ; 次の単位へ
      StrCpy $1 $0 ; 割る前の値も控えておく
      System::Int64Op $0 / 1024
      Pop $0
      IntOp $3 $3 + 1
    ${Else}
      ${ExitDo}
    ${EndIf}
  ${Loop}

  ; 小数点以下の部分を作る
  ; 1.63 や 16.3 や 163 など値の大きさに合わせて桁数を変える
  IntOp $1 $1 * 100
  IntOp $1 $1 / 1024
  IntOp $1 $1 % 100
  ${If} $2 == 1
    StrCpy $0 "$0.$1"
  ${ElseIf} $2 == 2
    IntOp $1 $1 / 10
    StrCpy $0 "$0.$1"
  ${EndIf}

  ${If} $3 == 0
    StrCpy $0 $1
    StrCpy $1 "バイト"
  ${ElseIf} $3 == 1
    StrCpy $1 "KB"
  ${ElseIf} $3 == 2
    StrCpy $1 "MB"
  ${ElseIf} $3 == 3
    StrCpy $1 "GB"
  ${ElseIf} $3 == 4
    StrCpy $1 "TB"
  ${ElseIf} $3 == 5
    StrCpy $1 "PB"
  ${ElseIf} $3 == 6
    StrCpy $1 "EB" ; 符号付き 64bit 整数の限界
  ${EndIf}

  StrCpy $0 "$0 $1"

                  ; Stack $3 $2 $1 $0
  Pop $3          ;       $2 $1 $0
  Pop $2          ;       $1 $0
  Pop $1          ;       $0
  Exch $0         ;       <Result>
  Pop "${Result}" ;       -empty-
!macroend

; ${getDiskSpace} Result Dir
; Dir に指定されたディレクトリがあるドライブの空き容量をバイト単位で取得する
; Windows 標準機能でドライブをフォルダへマウントしたりすると
; C:\somedir の空き容量が C:\ と一致するとは限らないため、調べたいディレクトリを渡す必要がある
; @param Dir 空き容量を調べたいディレクトリ
; @return Result インストール先の空き容量（バイト単位）、失敗時は ""
!define getDiskSpace "!insertmacro getDiskSpace"
!macro getDiskSpace Result Dir
  Push "${Dir}" ; Stack <Dir>
  Exch $0       ;       $0
  Push $1       ;       $1 $0

  ; 存在しないディレクトリだと失敗するので親を辿る
  getDiskSpace_loop:
  ${IfNot} ${FileExists} "$0\*.*"
    ${GetParent} $0 $0
    Goto getDiskSpace_loop
  ${EndIf}

  ; Input
  ;  $0 = 空き容量を調べたいディレクトリ
  ; Output
  ;  $0 = 取得した空き容量
  ;  $1 = 成功したかどうか
  System::Call 'kernel32::GetDiskFreeSpaceEx(t r0, *l .r0, l 0, l 0) i .r1'
  ${If} $1 == '0'
    StrCpy $0 ""
  ${EndIf}

  Pop $1          ;       $0
  Exch $0         ;       <Result>
  Pop "${Result}" ;       -empty-
!macroend

; ${verifyFile} Result FilePath HashAlgo Hash
; ファイルのハッシュ値を求めて検証する
; 使用可能なハッシュアルゴリズム名は以下を参照
; http://muldersoft.com/docs/stdutils_readme.html#e1f7e07b
; @param FilePath ファイルへのパス
; @param HashAlgo ハッシュアルゴリズム名
; @param Hash ハッシュ値（大文字16進数）
; @return Result "OK", "Failed" のどれか
!define verifyFile "!insertmacro verifyFile"
!macro verifyFile Result FilePath HashAlgo Hash
  Push "${Hash}"
  Push "${HashAlgo}"
  Push "${FilePath}" ; Stack <FilePath> <HashAlgo> <Hash>
  Exch $0            ;       $0 <HashAlgo> <Hash>
  Exch               ;       <HashAlgo> $0 <Hash>
  Exch $1            ;       $1 $0 <Hash>
  Exch               ;       $0 $1 <Hash>
  Exch 2             ;       <Hash> $1 $0
  Exch $2            ;       $2 $1 $0

  ${StdUtils.HashFile} $0 "$1" "$0"
  ${If} $0 == $2
    StrCpy $0 "OK"
  ${Else}
    StrCpy $0 "Failed"
  ${EndIf}

                  ; Stack $2 $1 $0
  Pop $2          ;       $1 $0
  Pop $1          ;       $0
  Exch $0         ;       <Result>
  Pop "${Result}" ;       -empty-
!macroend

; ${concatenateFile} Result DestPath BasePath NumFiles
; BasePath の末尾に ".0" のような 0 始まりの通し番号をつけたファイルを
; NumFiles 個連結して DestPath へ保存する
; @param DestPath 保存先へのパス
; @param BasePath 連結したいファイル
; @param NumFiles 連結する個数
; @return Result "OK", "Failed" のどれか
!define concatenateFile "!insertmacro concatenateFile"
!macro concatenateFile Result DestPath BasePath NumFiles
  Push "${NumFiles}" ; Stack <NumFiles>
  Push "${BasePath}" ;       <BasePath> <NumFiles>
  Push "${DestPath}" ;       <DestPath> <BasePath> <NumFiles>
  Exch $0            ;       $0 <BasePath> <NumFiles>
  Exch               ;       <BasePath> $0 <NumFiles>
  Exch $1            ;       $1 $0 <NumFiles>
  Exch               ;       $0 $1 <NumFiles>
  Exch 2             ;       <NumFiles> $1 $0
  Exch $2            ;       $2 $1 $0
  Push $3            ;       $3 $2 $1 $0
  Push $4            ;       $4 $3 $2 $1 $0

  StrCpy $4 $0    ; $4 = DestPath
  StrCpy $3 $1    ; $3 = BasePath
  IntOp $2 $2 - 1 ; $2 = NumFiles - 1

  ; 各パートのファイル名を連結していく
  StrCpy $1 ""
  ${ForEach} $0 0 $2 + 1
    StrCpy $1 `$1 + "$3.$0"`
  ${Next}

  ; ` + "BasePath.0" + "BasePath.1"`
  ; のような構造になっているので最初の3文字を削る
  StrCpy $1 $1 "" 3

  ; ファイルを連結する
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /C COPY /B $1 "$4"'
  Pop $0 ; ステータス
  Pop $1 ; エラーメッセージ（ここでは使わない）
  ${If} $0 == "0"
    StrCpy $0 "OK"
  ${Else}
    Delete "$4"
    StrCpy $0 "Failed"
  ${EndIf}

                  ; Stack $4 $3 $2 $1 $0
  Pop $4          ;       $3 $2 $1 $0
  Pop $3          ;       $2 $1 $0
  Pop $2          ;       $1 $0
  Pop $1          ;       $0
  Exch $0         ;       <Result>
  Pop "${Result}" ;       -empty-
!macroend

; ${getUncompressedSizeFrom7z} Result Path
; 7z アーカイブから展開後の総容量を求める
; "$PLUGINSDIR\7zr.exe" に事前にプログラムを配置しておくこと
; @param Path 7zアーカイブへのパス
; @return Result バイト単位での総容量, "Failed to execute 7zr.exe", "Failed to open file list" のどれか
!define getUncompressedSizeFrom7z "!insertmacro getUncompressedSizeFrom7z"
!macro getUncompressedSizeFrom7z Result Path
  Push "${Path}" ; Stack <Path>
  Exch $0        ;       $0
  Push $1        ;       $1 $0
  Push $2        ;       $2 $1 $0
  Push $3        ;       $3 $2 $1 $0

  ; /C の後ろ全体をダブルクォートで括る必要がある
  ; https://superuser.com/a/238813
  nsExec::ExecToStack '"$SYSDIR\cmd.exe" /C ""$PLUGINSDIR\7zr.exe" l -slt "$0" > "$PLUGINSDIR\7zlist.txt""'
  Pop $0 ; ステータス
  Pop $1 ; エラーメッセージ（ここでは使わない）
  ${If} $0 != "0"
    StrCpy $0 "Failed to execute 7zr.exe"
    Goto getUncompressedSizeFrom7z_finish
  ${EndIf}

  ClearErrors
  FileOpen $2 "$PLUGINSDIR\7zlist.txt" "r"
  ${If} ${Errors}
    StrCpy $0 "Failed to open file list"
    Goto getUncompressedSizeFrom7z_finish
  ${EndIf}

  ; 1行ずつ読んで展開後のサイズを加算していく
  ; $1 = 現在行のテキスト
  ; $2 = ファイルポインター
  ; $3 = 総容量
  StrCpy $3 0
  FileRead $2 $1
  ${DoUntil} ${Errors}
    StrCpy $0 $1 7 ; 最初の7文字を取り出す
    ${If} $0 == "Size = " ; 展開後のサイズが書いてある行か？
      StrCpy $0 $1 "" 7 ; 数値部分を取り出す
      System::Int64Op $3 + $0
      Pop $3
    ${EndIf}
    FileRead $2 $1
  ${Loop}
  FileClose $2

  StrCpy $0 $3

  getUncompressedSizeFrom7z_finish:
                  ; Stack $3 $2 $1 $0
  Pop $3          ;       $2 $1 $0
  Pop $2          ;       $1 $0
  Pop $1          ;       $0
  Exch $0         ;       <Result>
  Pop "${Result}" ;       -empty-
!macroend

; ${updateBannerText} Text
; 表示中の Banner のテキストを更新する
; Example の内容に基づく
; https://github.com/NSIS-Dev/Documentation/blob/master/Plugins/Banner.md#example
; @param Text 表示するテキスト
!define updateBannerText "!insertmacro updateBannerText"
!macro updateBannerText Text
  Push "${Text}" ; Stack <Text>
  Exch $0        ;       $0
  Push $1        ;       $1 $0
  Push $2        ;       $2 $1 $0

  Banner::getWindow
  Pop $1
  GetDlgItem $2 $1 1030
  SendMessage $2 ${WM_SETTEXT} 0 "STR:$0"

  Pop $2
  Pop $1
  Pop $0
!macroend

!endif
