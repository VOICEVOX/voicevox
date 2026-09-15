#!/usr/bin/env bash
# !!! コードサイニング証明書を取り扱うので取り扱い注意 !!!

# 公証用APIキーを一時ファイルを用意する

set -eu

if [ "${APPLE_API_KEY_BASE64+x}" != x ]; then
    echo "APPLE_API_KEY_BASE64が未定義です" >&2
    exit 1
fi
if [ "${APPLE_API_KEY_PATH+x}" != x ]; then
    echo "APPLE_API_KEY_PATHが未定義です" >&2
    exit 1
fi

echo "$APPLE_API_KEY_BASE64" | base64 --decode >"$APPLE_API_KEY_PATH"
