#!/usr/bin/env bash
# !!! コードサイニング証明書を取り扱うので取り扱い注意 !!!

# 公証用APIキーの一時ファイルを削除する

set -eu

if [ "${APPLE_API_KEY_PATH+x}" != x ]; then
    echo "APPLE_API_KEY_PATHが未定義です" >&2
    exit 1
fi

rm "$APPLE_API_KEY_PATH"
