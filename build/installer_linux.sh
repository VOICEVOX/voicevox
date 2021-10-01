#!/usr/bin/env bash
# VOICEVOX Installer Script

set -eu

NAME=$(basename "${NAME:-linux-nvidia-appimage}")
VERSION=$(basename "${VERSION:-}")
REPO_URL=${REPO_URL:-https://github.com/Hiroshiba/voicevox}

# Install directory
APP_DIR=${APP_DIR:-$HOME/.voicevox}
# keep archive if [ ${KEEP_ARCHIVE} = 1 ]
KEEP_ARCHIVE=${KEEP_ARCHIVE:-}

DESKTOP_ENTRY_INSTALL_DIR=${DESKTOP_ENTRY_INSTALL_DIR:-$HOME/.local/share/applications}
ICON_INSTALL_DIR=${ICON_INSTALL_DIR:-$HOME/.local/share/icons}

echo "Checking installer prerequisites..."

if ! command -v curl &> /dev/null; then
  echo ""
  echo "Command 'curl' not found"
  echo ""
  echo "Required to download VOICEVOX"
  echo ""
  echo "Ubuntu/Debian:"
  echo "    sudo apt install curl"
  echo ""
  echo "CentOS/Fedora:"
  echo "    sudo dnf install curl"
  echo "    sudo yum install curl"
  echo ""
  exit 1
fi

COMMAND_7Z=${COMMAND_7Z:-}
if [ ! -z "${COMMAND_7Z}" ]; then
  # use env var
  :
elif command -v 7z &> /dev/null; then
  # Ubuntu/Debian p7zip-full
  COMMAND_7Z=7z
elif command -v 7zr &> /dev/null; then
  # Ubuntu/Debian p7zip
  COMMAND_7Z=7zr
elif command -v 7za &> /dev/null; then
  # CentOS/Fedora
  COMMAND_7Z=7za
else
  echo ""
  echo "* Command '7z', '7zr' or '7za' not found"
  echo ""
  echo "Required to extract compressed files"
  echo ""
  echo "Ubuntu/Debian:"
  echo "    sudo apt install p7zip"
  echo ""
  echo "CentOS (Enable EPEL repository):"
  echo "    sudo dnf install epel-release && sudo dnf install p7zip"
  echo "    sudo yum install epel-release && sudo yum install p7zip"
  echo ""
  echo "Fedora:"
  echo "    sudo dnf install p7zip"
  echo "    sudo yum install p7zip"
  echo ""
  exit 1
fi
echo "7z command: ${COMMAND_7Z}"

LATEST_RELEASE_URL=$REPO_URL/releases/latest

if [ -z "${VERSION}" ]; then
    echo "Checking the latest version: ${LATEST_RELEASE_URL}"

    # releases/tag/{version}
    RELEASE_TAG_URL=$(curl -fsSL -o /dev/null -w '%{url_effective}' "${LATEST_RELEASE_URL}")

    # extract version (release tag name) from URL
    VERSION=$(echo "${RELEASE_TAG_URL}" | sed 's/.*\/\(.*\)$/\1/')
fi

echo "Install version: ${VERSION}"

RELEASE_URL=${REPO_URL}/releases/download/${VERSION}
ARCHIVE_LIST_URL=${RELEASE_URL}/${NAME}.7z.txt

mkdir -p "${APP_DIR}"

cd "${APP_DIR}"

# Download archive list
echo "Downloading ${ARCHIVE_LIST_URL}"
curl --fail -L -o "list.txt" "${ARCHIVE_LIST_URL}"

echo ""
echo "Download list"
ARCHIVE_LIST=($(cat "list.txt"))
for filename in ${ARCHIVE_LIST[@]}; do
  echo "* ${filename}"
done
echo ""

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
${COMMAND_7Z} x "${FIRST_ARCHIVE}" -y

# Dump version
echo "Dumping version"
echo "${VERSION}" > VERSION

# Remove archives
if [ "${KEEP_ARCHIVE}" != "1" ]; then
    echo "Removing splitted archives"

    for filename in ${ARCHIVE_LIST[@]}; do
        echo "Removing ${filename}"
        rm -f "${filename}"
    done
fi

# Remove archive list
rm -f "list.txt"

# Extract desktop entry
echo "Extacting desktop entry"

APPIMAGE=$(echo "${FIRST_ARCHIVE}" | sed 's/\(.*.AppImage\).*/\1/')
chmod +x "${APPIMAGE}"

./${APPIMAGE} --appimage-extract '*.desktop'
./${APPIMAGE} --appimage-extract 'usr/share/icons/**'
./${APPIMAGE} --appimage-extract '*.png' # symbolic link to icon

# Install desktop entry
echo "Installing desktop entry"

DESKTOP_FILE=$(ls squashfs-root/*.desktop | head -n1)
chmod +x "${DESKTOP_FILE}"

ESCAPED_APP_DIR=$(echo "$APP_DIR" | sed 's/\//\\\//g')
sed -i "s/Exec=.*/Exec=${ESCAPED_APP_DIR}\/${APPIMAGE}/" "${DESKTOP_FILE}"

mkdir -p "${DESKTOP_ENTRY_INSTALL_DIR}"
mv "${DESKTOP_FILE}" "${DESKTOP_ENTRY_INSTALL_DIR}"

# Install icon
echo "Installing icon"

mkdir -p "${ICON_INSTALL_DIR}"
cp -r squashfs-root/usr/share/icons/* "${ICON_INSTALL_DIR}"
cp squashfs-root/*.png "${ICON_INSTALL_DIR}"

# Remove extract dir
echo "Removing temporal directory"
rm -rf squashfs-root

echo "All done! VOICEVOX ${VERSION} installed."
