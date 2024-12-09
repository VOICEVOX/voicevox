# !!! コードサイニング証明書を取り扱うので取り扱い注意 !!!

# eSignerCKAを使ってコードサイニング証明書を読み込む
# electronから利用するためにTHUMBPRINTとsigntoolのパスを出力する

set -eu

if [ ! -v ESIGNERCKA_USERNAME ]; then # eSignerCKAのユーザー名
    echo "ESIGNERCKA_USERNAMEが未定義です"
    exit 1
fi
if [ ! -v ESIGNERCKA_PASSWORD ]; then # eSignerCKAのパスワード
    echo "ESIGNERCKA_PASSWORDが未定義です"
    exit 1
fi
if [ ! -v ESIGNERCKA_TOTP_SECRET ]; then # eSignerCKAのTOTP Secret
    echo "ESIGNERCKA_TOTP_SECRETが未定義です"
    exit 1
fi
if [ ! -v THUMBPRINT_PATH ]; then # THUMBPRINTの出力先
    echo "THUMBPRINT_PATHが未定義です"
    exit 1
fi
if [ ! -v SIGNTOOL_PATH_PATH ]; then # 対応しているsigntoolのパスの出力先
    echo "SIGNTOOL_PATH_PATHが未定義です"
    exit 1
fi

if [ ! -v ESIGNERCKA_INSTALL_DIR ]; then
    ESIGNERCKA_INSTALL_DIR='..\eSignerCKA'
fi

# eSignerCKAのセットアップ
if [ ! -d "$ESIGNERCKA_INSTALL_DIR" ]; then
    curl -LO --retry 3 --retry-delay 5 \
        "https://github.com/SSLcom/eSignerCKA/releases/download/v1.0.6/SSL.COM-eSigner-CKA_1.0.6.zip"
    unzip -o SSL.COM-eSigner-CKA_1.0.6.zip
    mv *eSigner*CKA_*.exe eSigner_CKA_Installer.exe
    powershell "
        & ./eSigner_CKA_Installer.exe /CURRENTUSER /VERYSILENT /SUPPRESSMSGBOXES /DIR="$ESIGNERCKA_INSTALL_DIR" | Out-Null
        & '$ESIGNERCKA_INSTALL_DIR\eSignerCKATool.exe' config -mode product -user '$ESIGNERCKA_USERNAME' -pass '$ESIGNERCKA_PASSWORD' -totp '$ESIGNERCKA_TOTP_SECRET' -key '$ESIGNERCKA_INSTALL_DIR\master.key' -r
        & '$ESIGNERCKA_INSTALL_DIR\eSignerCKATool.exe' unload
    "
    rm SSL.COM-eSigner-CKA_1.0.6.zip eSigner_CKA_Installer.exe
fi

# 証明書を読み込む
powershell "& '$ESIGNERCKA_INSTALL_DIR\eSignerCKATool.exe' load"

THUMBPRINT=$(
    powershell '
        $CodeSigningCert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Select-Object -First 1
        echo "$($CodeSigningCert.Thumbprint)"
    '
)

# THUMBPRINTを出力
echo "$THUMBPRINT" >"$THUMBPRINT_PATH"

# 対応しているsigntoolのパスを出力
SIGNTOOL_PATH=$(ls "C:/Program Files (x86)/Windows Kits/"10/bin/*/x86/signtool.exe | sort -V | tail -n 1) # なぜかこれじゃないと動かない
echo "$SIGNTOOL_PATH" >"$SIGNTOOL_PATH_PATH"
