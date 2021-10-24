#!/usr/bin/env bash
# VOICEVOX Installer Script

# set -x # Debug mode: output verbose log
set -euo pipefail
IFS=$'\n\t'

cat << 'EOS'
+-+-+-+-+-+-+-+-+
|V|O|I|C|E|V|O|X|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
          |I|n|s|t|a|l|l|e|r|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|f|o|r| |L|i|n|u|x|
+-+-+-+-+-+-+-+-+-+
EOS

NAME=$(basename "${NAME:-linux-nvidia-appimage}")
VERSION=$(basename "${VERSION:-}")
REPO_URL=${REPO_URL:-https://github.com/Hiroshiba/voicevox}

# Install directory
APP_DIR=${APP_DIR:-$HOME/.voicevox}
# keep archive if [ ${KEEP_ARCHIVE} = 1 ]
KEEP_ARCHIVE=${KEEP_ARCHIVE:-}
REUSE_LIST=${REUSE_LIST:-}
SKIP_VERIFY=${SKIP_VERIFY:-}
IGNORE_RTCOND=${IGNORE_RTCOND:-}

DESKTOP_ENTRY_INSTALL_DIR=${DESKTOP_ENTRY_INSTALL_DIR:-$HOME/.local/share/applications}
ICON_INSTALL_DIR=${ICON_INSTALL_DIR:-$HOME/.local/share/icons}

echo "[+] Checking installer prerequisites..."

if ! command -v curl &> /dev/null; then
    cat << EOS

[!] Command 'curl' not found

Required to download VOICEVOX

Ubuntu/Debian:
    sudo apt install curl

CentOS/Fedora:
    sudo dnf install curl
Or
    sudo yum install curl

EOS
    exit 1
fi

COMMAND_7Z=${COMMAND_7Z:-}
if [ -n "${COMMAND_7Z}" ]; then
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
    cat << 'EOS'

[!] Command '7z', '7zr' or '7za' not found

Required to extract compressed files

Ubuntu/Debian:
    sudo apt install p7zip

CentOS (Enable EPEL repository):
    sudo dnf install epel-release && sudo dnf install p7zip
Or
    sudo yum install epel-release && sudo yum install p7zip

Fedora:
    sudo dnf install p7zip
Or
    sudo yum install p7zip

EOS
    exit 1
fi
echo "[+] 7z command: ${COMMAND_7Z}"

echo "[+] Checking runtime prerequisites..."

if ldconfig -p | grep libsndfile\.so &> /dev/null; then
    echo "[+] libsndfile: OK"
else
    cat << 'EOS'

[!] libsndfile: not found

Required to run VOICEVOX ENGINE

Ubuntu/Debian:
    sudo apt install libsndfile1

CentOS/Fedora:
    sudo dnf install libsndfile
Or
    sudo yum install libsndfile

EOS
    if [ "${IGNORE_RTCOND}" != "1" ]; then
        exit 1
    fi
fi

LATEST_RELEASE_URL=$REPO_URL/releases/latest

if [ -z "${VERSION}" ]; then
    echo "[+] Checking the latest version..."

    # releases/tag/{version}
    RELEASE_TAG_URL=$(curl -fsSL -o /dev/null -w '%{url_effective}' "${LATEST_RELEASE_URL}")

    # extract version (release tag name) from URL
    VERSION=$(echo "${RELEASE_TAG_URL}" | sed 's/.*\/\(.*\)$/\1/')
    echo "[+] Install version: ${VERSION} (latest)"
else
    echo "[+] Install version: ${VERSION}"
fi

RELEASE_URL=${REPO_URL}/releases/download/${VERSION}
ARCHIVE_LIST_URL=${RELEASE_URL}/${NAME}.7z.txt

echo "[+] Install directory: ${APP_DIR}"
mkdir -p "${APP_DIR}"

cd "${APP_DIR}"

# Download archive list
if [ "$REUSE_LIST" != "1" ]; then
    echo "[+] Downloading ${ARCHIVE_LIST_URL}..."
    curl --fail -L -o "list.txt" "${ARCHIVE_LIST_URL}"
fi

echo
echo "[+] Listing of splitted archives..."
readarray ARCHIVE_LIST < "list.txt"

if [ -z "$(echo "${ARCHIVE_LIST[0]}" | awk '$0=$1')" ]; then
    # No size/hash information
    # filename
    IFS=$'\n' read -d '' -r -a ARCHIVE_NAME_LIST <<< "$(for index in "${!ARCHIVE_LIST[@]}"; do echo "${ARCHIVE_LIST[index]}"; done))"
    IFS=$'\n' read -d '' -r -a ARCHIVE_SIZE_LIST <<< "$(for index in "${!ARCHIVE_LIST[@]}"; do echo "x"; done)"
    IFS=$'\n' read -d '' -r -a ARCHIVE_HASH_LIST <<< "$(for index in "${!ARCHIVE_LIST[@]}"; do echo "x"; done)"
else
    # filename<TAB>size<TAB>hash
    IFS=$'\n' read -d '' -r -a ARCHIVE_NAME_LIST <<< "$(for index in "${!ARCHIVE_LIST[@]}"; do echo -n "${ARCHIVE_LIST[index]}" | awk '$0=$1'; done)"
    IFS=$'\n' read -d '' -r -a ARCHIVE_SIZE_LIST <<< "$(for index in "${!ARCHIVE_LIST[@]}"; do echo -n "${ARCHIVE_LIST[index]}" | awk '$0=$2'; done)"
    IFS=$'\n' read -d '' -r -a ARCHIVE_HASH_LIST <<< "$(for index in "${!ARCHIVE_LIST[@]}"; do echo -n "${ARCHIVE_LIST[index]}" | awk '$0=$3' | tr '[:lower:]' '[:upper:]'; done)"
fi
echo

for index in "${!ARCHIVE_NAME_LIST[@]}"; do
    echo "$index. ${ARCHIVE_NAME_LIST[$index]} ${ARCHIVE_SIZE_LIST[$index]} ${ARCHIVE_HASH_LIST[$index]}"
done
echo

# Download archives
for index in "${!ARCHIVE_NAME_LIST[@]}"; do
    FILENAME=${ARCHIVE_NAME_LIST[$index]}
    SIZE=${ARCHIVE_SIZE_LIST[$index]}
    HASH=${ARCHIVE_HASH_LIST[$index]}

    URL=${RELEASE_URL}/${FILENAME}

    echo "[+] Downloading ${URL}..."
    if [ ! -f "${FILENAME}" ]; then
        curl --fail -L -C - -o "${FILENAME}.tmp" "${URL}"
        mv "${FILENAME}.tmp" "${FILENAME}"
    fi

    # File verification (size, md5 hash)
    if [ "$SKIP_VERIFY" = "1" ]; then
        echo "[+] File verification skipped"
    else
        if [ "$SIZE" != "x" ]; then
            echo "[+] Verifying size == $SIZE"
            DOWNLOADED_SIZE=$(stat --printf="%s" "${FILENAME}")

            if [ "$DOWNLOADED_SIZE" = "$SIZE" ]; then
                echo "[+] Size OK"
            else
                cat << EOS
[!] Invalid size: ${DOWNLOADED_SIZE} != ${SIZE}

Remove the corrupted file and restart installer!

    rm $(realpath "${FILENAME}")

EOS
                exit 1
            fi
        fi

        if [ "$HASH" != "x" ]; then
            echo "[+] Verifying hash == ${HASH}..."
            DOWNLOADED_HASH=$(md5sum "${FILENAME}" | awk '$0=$1' | tr '[:lower:]' '[:upper:]')
            if [ "$DOWNLOADED_HASH" = "$HASH" ]; then
                echo "[+] Hash OK"
            else
                cat << EOS
[!] Invalid hash: ${DOWNLOADED_HASH} != ${HASH}

Remove the corrupted file and restart installer!

    rm $(realpath "${FILENAME}")

EOS
                exit 1
            fi
        fi
    fi
done

# Extract archives
FIRST_ARCHIVE=${ARCHIVE_NAME_LIST[0]}
${COMMAND_7Z} x "${FIRST_ARCHIVE}" -y

# Get AppImage filename from 7z archive
APPIMAGE=$(${COMMAND_7Z} l -slt -ba "${FIRST_ARCHIVE}" | grep 'Path = ' | head -n1 | sed 's/Path = \(.*\)/\1/')
chmod +x "${APPIMAGE}"

# Dump version
echo "[+] Dumping version..."
echo "${VERSION}" > VERSION

# Create uninstaller
echo "[+] Creating uninstaller..."
cat << 'EOS' > uninstaller_linux.sh
#!/usr/bin/env bash

set -euo pipefail
IFS=$'\n\t'

VOICEVOX_INSTALLED_FILES=(
    ~/.local/share/applications/voicevox.desktop
    ~/.local/share/icons/voicevox.png
)

VOICEVOX_INSTALLED_DIR=(
    ~/.voicevox
)

echo "[+] Uninstalling VOICEVOX..."
for i in "${VOICEVOX_INSTALLED_FILES[@]}"; do
    [ -e "$i" ] || continue
    echo "[+] Removing '${i}'..."
    if [ -f "$i" ]; then
        rm -f "$i"
    else
        echo "[!] '$i' is not a file"
        exit 1
    fi
done

for i in "${VOICEVOX_INSTALLED_DIR[@]}"; do
    [ -e "$i" ] || continue
    echo "[+] Removing '${i}'..."
    if [ -d "$i" ]; then
        rm -rf "$i"
    else
        echo "[!] '$i' is not a directory"
        exit 1
    fi
done

echo "[+] Done! VOICEVOX has been uninstalled."

EOS
chmod +x uninstaller_linux.sh

# Remove archives
if [ "${KEEP_ARCHIVE}" != "1" ]; then
    echo "[+] Removing splitted archives..."

    for filename in "${ARCHIVE_NAME_LIST[@]}"; do
        echo "[+] Removing ${filename}..."
        rm -f "${filename}"
    done
fi

# Remove archive list
echo "[+] Removing archive list (list.txt)..."
rm -f "list.txt"

# Extract desktop entry
echo "[+] Extacting desktop entry..."

"./${APPIMAGE}" --appimage-extract '*.desktop'
"./${APPIMAGE}" --appimage-extract 'usr/share/icons/**'
"./${APPIMAGE}" --appimage-extract '*.png' # symbolic link to icon

# Install desktop entry
echo "[+] Installing desktop entry..."

DESKTOP_FILE=$(find squashfs-root -maxdepth 1 -name '*.desktop' | head -1)
chmod +x "${DESKTOP_FILE}"

ESCAPED_APP_DIR=$(echo "$APP_DIR" | sed 's/\//\\\//g')
sed -i "s/Exec=.*/Exec=${ESCAPED_APP_DIR}\/${APPIMAGE}/" "${DESKTOP_FILE}"

mkdir -p "${DESKTOP_ENTRY_INSTALL_DIR}"
mv "${DESKTOP_FILE}" "${DESKTOP_ENTRY_INSTALL_DIR}"

# Install icon
echo "[+] Installing icon..."

mkdir -p "${ICON_INSTALL_DIR}"
cp -r squashfs-root/usr/share/icons/* "${ICON_INSTALL_DIR}"
cp squashfs-root/*.png "${ICON_INSTALL_DIR}"

# Remove extract dir
echo "[+] Removing temporal directory..."
rm -rf squashfs-root

echo "[+] All done! VOICEVOX ${VERSION} has been installed under '${APP_DIR}'."
