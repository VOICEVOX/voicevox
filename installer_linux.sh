#!/usr/bin/env bash
# VOICEVOX Installer Script

set -eux

KEEP_ARCHIVE=${KEEP_ARCHIVE:-}
NAME=$(basename "${NAME:-linux-nvidia-appimage}")
VERSION=$(basename "${VERSION:-}")
REPO_URL=${REPO_URL:-https://github.com/Hiroshiba/voicevox}

VERSION=0.6.1-aoirint-28
REPO_URL=https://github.com/aoirint/voicevox

LATEST_RELEASE_URL=$REPO_URL/releases/latest

if [ -z "${VERSION}" ]; then
    # releases/tag/{version}
    RELEASE_TAG_URL=$(curl -sL -o /dev/null -w '%{url_effective}' "${LATEST_RELEASE_URL}")

    VERSION=$(echo "${RELEASE_TAG_URL}" | sed 's/.*\/\(.*\)$/\1/')
fi


RELEASE_URL=${REPO_URL}/releases/download/${VERSION}
ARCHIVE_LIST_URL=${RELEASE_URL}/${NAME}.7z.txt

APPDIR=$HOME/.voicevox
mkdir -p "${APPDIR}"

cd "${APPDIR}"

# Download archive list
echo "Downloading ${ARCHIVE_LIST_URL}"
curl --fail -L -o "list.txt" "${ARCHIVE_LIST_URL}"

ARCHIVE_LIST=($(cat "list.txt"))

# Download archives
for filename in ${ARCHIVE_LIST[@]}; do
    URL=${RELEASE_URL}/${filename}

    echo "Downloading ${URL}"
    if [ ! -f "${filename}" ]; then
        curl --fail -L -C - -o "${filename}.tmp" "${URL}"
        mv "${filename}.tmp" "${filename}"
    fi
done

# Extract archives
FIRST_ARCHIVE=${ARCHIVE_LIST[0]}
7z x "${FIRST_ARCHIVE}" -y

# Remove archives
if [ "${KEEP_ARCHIVE}" != "1" ]; then
    for filename in ${ARCHIVE_LIST[@]}; do
        echo "Removing ${filename}"
        rm -f "${filename}"
    done
fi

# Remove archive list
rm -f "list.txt"

# Extract desktop entry
APPIMAGE=$(echo "${FIRST_ARCHIVE}" | sed 's/\(.*.AppImage\).*/\1/')
chmod +x "${APPIMAGE}"

./${APPIMAGE} --appimage-extract '*.desktop'
./${APPIMAGE} --appimage-extract 'usr/share/icons/**'
./${APPIMAGE} --appimage-extract '*.png' # symbolic link to icon

# Install desktop entry
DESKTOP_FILE=$(ls squashfs-root/*.desktop | head -n1)
chmod +x "${DESKTOP_FILE}"

sed -i "s/Exec=.*/Exec=\/home\/$USER\/.voicevox\/${APPIMAGE}/" "${DESKTOP_FILE}"

mv "${DESKTOP_FILE}" "$HOME/.local/share/applications/"

# Install icon
cp -r squashfs-root/usr/share/icons/* "$HOME/.local/share/icons/"
cp squashfs-root/*.png "$HOME/.local/share/icons/"

# Remove extract dir
rm -rf squashfs-root
