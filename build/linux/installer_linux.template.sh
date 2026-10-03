#!/usr/bin/env bash
# VOICEVOX Installer Script

# set -x # Debug mode: output verbose log
set -euo pipefail
IFS=$'\n\t'

cat << 'BANNER'
+-+-+-+-+-+-+-+-+
|V|O|I|C|E|V|O|X|
+-+-+-+-+-+-+-+-+-+-+-+-+-+
        |I|n|s|t|a|l|l|e|r|
+-+-+-+-+-+-+-+-+-+-+-+-+-+
|f|o|r| |L|i|n|u|x|
+-+-+-+-+-+-+-+-+-+
BANNER

NAME=@@PLACEHOLDER@@ # placeholder for CI
VERSION=@@PLACEHOLDER@@ # placeholder for CI
REPO_URL=${REPO_URL:-https://github.com/VOICEVOX/voicevox}

# Install directory
APP_DIR=${APP_DIR:-$HOME/.voicevox}
# force install if [ ${FORCE_INSTALL} = 1 ]
FORCE_INSTALL=${FORCE_INSTALL:-}
# keep archive if [ ${KEEP_ARCHIVE} = 1 ]
KEEP_ARCHIVE=${KEEP_ARCHIVE:-}
REUSE_LIST=${REUSE_LIST:-}
SKIP_VERIFY=${SKIP_VERIFY:-}

DESKTOP_ENTRY_INSTALL_DIR=${DESKTOP_ENTRY_INSTALL_DIR:-$HOME/.local/share/applications}
ICON_INSTALL_DIR=${ICON_INSTALL_DIR:-$HOME/.local/share/icons}
MIME_INSTALL_DIR=${MIME_INSTALL_DIR:-$HOME/.local/share/mime}

if [ "$FORCE_INSTALL" != "1" ] && [ -f "${APP_DIR}/VOICEVOX.AppImage" ]; then
    echo "[*] VOICEVOX already installed in '${APP_DIR}/VOICEVOX.AppImage'."
    while true; do
        read -r -p "[*] Replace?(y/n): " yn
        case "$yn" in
            [Yy]*)
                break
                ;;
            [Nn]*)
                exit 0
                ;;
            *)
                echo "[*] Please answer y(es) or n(o)."
                ;;
        esac
    done
fi

echo "[+] Checking installer prerequisites..."

if ! command -v curl &> /dev/null; then
    cat << EOS && exit 1
[!] Command 'curl' not found

Required to download VOICEVOX

Ubuntu/Debian:
    sudo apt install curl

CentOS/Fedora:
    sudo dnf install curl
Or
    sudo yum install curl
EOS
fi

RELEASE_URL=${REPO_URL}/releases/download/${VERSION}
ARCHIVE_LIST_URL=${RELEASE_URL}/${NAME}.AppImage.txt

echo "[-] Install directory: ${APP_DIR}"
mkdir -p "${APP_DIR}"

cd "${APP_DIR}"

# Download archive list
if [ "$REUSE_LIST" != "1" ]; then
    echo "[+] Downloading ${ARCHIVE_LIST_URL}..."
    curl --fail -L -o "list.txt" "${ARCHIVE_LIST_URL}"
fi

echo
# Download archives
mapfile -t ARCHIVE_NAME_LIST < <(cut -d' ' -f3- list.txt)
for FILENAME in "${ARCHIVE_NAME_LIST[@]}"; do
    URL=${RELEASE_URL}/${FILENAME}

    echo "[+] Downloading ${URL}..."
    if [ ! -f "${FILENAME}" ]; then
        curl --fail -L -C - -o "${FILENAME}.tmp" "${URL}"
        mv "${FILENAME}.tmp" "${FILENAME}"
    fi
done

# File verification
if [ "$SKIP_VERIFY" = "1" ]; then
    echo "[-] File verification skipped"
else
    if ! sha256sum --check list.txt; then
        echo "[!] Invalid hash. Remove the corrupted files and restart installer!"
        exit 1
    fi
fi

# Concatenate split AppImage files
echo "[+] Concatenating split AppImage files..."
APPIMAGE="VOICEVOX.AppImage"
mv "${ARCHIVE_NAME_LIST[0]}" "${APPIMAGE}"
if [ "${#ARCHIVE_NAME_LIST[@]}" -gt 1 ]; then
    cat "${ARCHIVE_NAME_LIST[@]:1}" >> "${APPIMAGE}"
fi
chmod +x "${APPIMAGE}"

# Dump version
echo "[+] Dumping version..."
echo "${VERSION}" > VERSION

# Create uninstaller
echo "[+] Creating uninstaller..."
cat << EOS > uninstaller_linux.sh && chmod +x uninstaller_linux.sh
#!/usr/bin/env bash

set -euo pipefail
IFS=\$'\n\t'

cat << 'BANNER'
+-+-+-+-+-+-+-+-+
|V|O|I|C|E|V|O|X|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
        |U|n|i|n|s|t|a|l|l|e|r|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|f|o|r| |L|i|n|u|x|
+-+-+-+-+-+-+-+-+-+
BANNER

VOICEVOX_INSTALLED_FILES=(
    "${DESKTOP_ENTRY_INSTALL_DIR}/voicevox.desktop"
    "${ICON_INSTALL_DIR}/voicevox.png"
    "${ICON_INSTALL_DIR}/hicolor/256x256/apps/voicevox.png"
    "${MIME_INSTALL_DIR}/packages/voicevox.xml"
)

VOICEVOX_INSTALLED_DIR=(
    "${APP_DIR}"
)

echo "[+] Uninstalling VOICEVOX..."
for i in "\${VOICEVOX_INSTALLED_FILES[@]}"; do
    [ -e "\$i" ] || continue
    echo "[+] Removing '\${i}'..."
    if [ -f "\$i" ]; then
        rm -f "\$i"
    else
        echo "[!] '\$i' is not a file"
        exit 1
    fi
done

for i in "\${VOICEVOX_INSTALLED_DIR[@]}"; do
    [ -e "\$i" ] || continue
    echo "[+] Removing '\${i}'..."
    if [ -d "\$i" ]; then
        rm -rf "\$i"
    else
        echo "[!] '\$i' is not a directory"
        exit 1
    fi
done

echo "[+] Done! VOICEVOX has been uninstalled."

EOS

# Remove archives
if [ "${KEEP_ARCHIVE}" != "1" ]; then
    echo "[+] Removing split archives..."

    for filename in "${ARCHIVE_NAME_LIST[@]}"; do
        echo "[+] Removing ${filename}..."
        rm -f "${filename}"
    done
fi

# Remove archive list
echo "[+] Removing archive list (list.txt)..."
rm -f "list.txt"

# Extract desktop entry
echo "[+] Extracting desktop entry..."

"./${APPIMAGE}" --appimage-extract '*.desktop'
"./${APPIMAGE}" --appimage-extract 'usr/share/icons/**'
"./${APPIMAGE}" --appimage-extract '*.png' # symbolic link to icon

# Install desktop entry
echo "[+] Installing desktop entry..."

DESKTOP_FILE=$(find squashfs-root -maxdepth 1 -name '*.desktop' | head -1)
chmod +x "${DESKTOP_FILE}"

ESCAPED_APP_DIR=$(echo "$APP_DIR" | sed 's/\//\\\//g')
sed "s/Exec=[^[:space:]]*/Exec=${ESCAPED_APP_DIR}\/${APPIMAGE}/" "${DESKTOP_FILE}" > _
mv _ "${DESKTOP_FILE}"

mkdir -p "${DESKTOP_ENTRY_INSTALL_DIR}"
mv "${DESKTOP_FILE}" "${DESKTOP_ENTRY_INSTALL_DIR}"

# Install icon
echo "[+] Installing icon..."

mkdir -p "${ICON_INSTALL_DIR}"
cp -r squashfs-root/usr/share/icons/* "${ICON_INSTALL_DIR}"
cp squashfs-root/*.png "${ICON_INSTALL_DIR}"

# Register file association
echo "[+] Registering file association..."

mkdir -p "${MIME_INSTALL_DIR}/packages"
curl --fail -L -o "${MIME_INSTALL_DIR}/packages/voicevox.xml" "https://raw.githubusercontent.com/VOICEVOX/voicevox/refs/tags/${VERSION}/build/linux/voicevox.xml"

# Update file association database
echo "[+] Updating file association database..."
if command -v update-mime-database &> /dev/null; then
    update-mime-database "${MIME_INSTALL_DIR}"
else
    echo "[-] Skipped: Command 'update-mime-database' not found"
fi

# Update desktop file database
echo "[+] Updating desktop file database..."
if command -v update-desktop-database &> /dev/null; then
    update-desktop-database "${DESKTOP_ENTRY_INSTALL_DIR}"
else
    echo "[-] Skipped: Command 'update-desktop-database' not found"
fi

# Remove extract dir
echo "[+] Removing temporal directory..."
rm -rf squashfs-root

echo "[+] All done! VOICEVOX ${VERSION} has been installed under '${APP_DIR}'."
