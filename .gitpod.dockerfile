FROM gitpod/workspace-full-vnc

USER gitpod

RUN sudo apt-get update && \
  # GUI
  sudo apt-get install -y libgtk-3-dev && \
  sudo apt-get install -y libxss1 libnss3-dev libasound2 x11-apps x11-utils x11-xserver-utils fonts-ipafont && \
  # pyopenjtalk
  sudo apt-get install -y cmake build-essential libssl-dev libffi-dev python3-dev cython && \
  # soundfile
  sudo apt-get install -y libsndfile1 && \
  sudo apt-get install -y debconf-utils && \
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq language-pack-ja-base language-pack-ja fonts-takao fcitx fcitx-mozc fonts-inconsolata && \
  echo 'keyboard-configuration keyboard-configuration/variant select Japanese' | sudo debconf-set-selections && \
  sudo dpkg-reconfigure -f noninteractive -plow keyboard-configuration && \
  sudo apt-get clean && \
  sudo rm -rf /var/lib/apt/lists/*

ENV RUN_ENGINE_EXTERNAL true
ENV VUE_APP_ENGINE_URL http://127.0.0.1:50021
