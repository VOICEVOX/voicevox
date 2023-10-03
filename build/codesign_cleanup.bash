# !!! コードサイニング証明書を取り扱うので取り扱い注意 !!!

set -eu

if [ ! -v THUMBPRINT_PATH ]; then
    echo "THUMBPRINT_PATHが未定義です"
    exit 1
fi

if [ ! -v ESIGNERCKA_INSTALL_DIR ]; then
    ESIGNERCKA_INSTALL_DIR='..\eSignerCKA'
fi

# 証明書を削除
powershell "& '$ESIGNERCKA_INSTALL_DIR\eSignerCKATool.exe' unload"

# THUMBPRINTを削除
rm "$THUMBPRINT_PATH"
