#!/bin/sh

cd /workspace/voicevox

npm ci

LATEST_TAG=$(curl -w "%{redirect_url}" -s -o /dev/null https://github.com/Hiroshiba/voicevox_engine/releases/latest | awk '{split($0,arr,"/");print arr[length(arr)]}')
git clone -b ${LATEST_TAG} --depth 1 https://github.com/Hiroshiba/voicevox_engine.git ./voicevox_engine

pyenv install 3.7.9
pyenv local 3.7.9
pip install -r ./voicevox_engine/requirements.txt
