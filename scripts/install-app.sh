#!/bin/bash

set -e

VERSIONS_URL="https://agents.rocket.app/electron"
DOWNLOAD_DIR="$HOME/.rocket/downloads"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info() { printf "%b\n" "${BLUE}>${NC} $1"; }
success() { printf "%b\n" "${GREEN}>${NC} $1"; }
warn() { printf "%b\n" "${YELLOW}!${NC} $1"; }
error() { printf "%b\n" "${RED}x${NC} $1"; exit 1; }

# Detect OS
OS="$(uname -s)"
case "$OS" in
    Darwin) OS_TYPE="darwin" ;;
    Linux)  OS_TYPE="linux" ;;
    *)      error "Unsupported operating system: $OS" ;;
esac

# Check for required dependencies
DOWNLOADER=""
if command -v curl >/dev/null 2>&1; then
    DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
    DOWNLOADER="wget"
else
    error "Either curl or wget is required but neither is installed"
fi

# Check if yq is available (optional, for YAML parsing)
HAS_YQ=false
if command -v yq >/dev/null 2>&1; then
    HAS_YQ=true
fi

# Download function that works with both curl and wget
# Usage: download_file <url> [output_file] [show_progress]
download_file() {
    local url="$1"
    local output="$2"
    local show_progress="${3:-false}"

    if [ "$DOWNLOADER" = "curl" ]; then
        if [ -n "$output" ]; then
            if [ "$show_progress" = "true" ]; then
                curl -fL --progress-bar -o "$output" "$url"
            else
                curl -fsSL -o "$output" "$url"
            fi
        else
            curl -fsSL "$url"
        fi
    elif [ "$DOWNLOADER" = "wget" ]; then
        if [ -n "$output" ]; then
            if [ "$show_progress" = "true" ]; then
                wget --show-progress -q -O "$output" "$url"
            else
                wget -q -O "$output" "$url"
            fi
        else
            wget -q -O - "$url"
        fi
    else
        return 1
    fi
}

# Extract a file entry for a specific architecture.
# electron-builder omits `arch:` for single-architecture manifests, so prefer
# explicit metadata, then the canonical artifact filename, then a single entry.
get_entry_from_yaml() {
    local yaml="$1"
    local target_arch="$2"
    local explicit_match=""
    local filename_match=""
    local only_entry=""
    local entry_count=0
    local url sha512 entry_arch

    while IFS=$'\t' read -r url sha512 entry_arch; do
        if [ -z "$url" ] || [ -z "$sha512" ]; then
            continue
        fi

        entry_count=$((entry_count + 1))
        only_entry="${url}"$'\t'"${sha512}"

        if [ "$entry_arch" = "$target_arch" ] && [ -z "$explicit_match" ]; then
            explicit_match="$only_entry"
        fi

        case "$url" in
            *-"$target_arch".*|*_"$target_arch".*|*."$target_arch".*)
                if [ -z "$filename_match" ]; then
                    filename_match="$only_entry"
                fi
                ;;
        esac
    done < <(
        printf '%s\n' "$yaml" | awk '
            function emit() {
                if (url != "" && sha512 != "") {
                    printf "%s\t%s\t%s\n", url, sha512, arch
                }
            }
            /^[[:space:]]*-[[:space:]]*url:[[:space:]]*/ {
                emit()
                line = $0
                sub(/^[[:space:]]*-[[:space:]]*url:[[:space:]]*/, "", line)
                url = line
                sha512 = ""
                arch = ""
                next
            }
            url != "" && /^[[:space:]]+sha512:[[:space:]]*/ {
                line = $0
                sub(/^[[:space:]]+sha512:[[:space:]]*/, "", line)
                sha512 = line
                next
            }
            url != "" && /^[[:space:]]+arch:[[:space:]]*/ {
                line = $0
                sub(/^[[:space:]]+arch:[[:space:]]*/, "", line)
                arch = line
                next
            }
            END { emit() }
        '
    )

    if [ -n "$explicit_match" ]; then
        printf '%s\n' "$explicit_match"
        return 0
    fi
    if [ -n "$filename_match" ]; then
        printf '%s\n' "$filename_match"
        return 0
    fi
    if [ "$entry_count" -eq 1 ]; then
        printf '%s\n' "$only_entry"
        return 0
    fi
    return 1
}

# Detect architecture
case "$(uname -m)" in
    x86_64|amd64) arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) error "Unsupported architecture: $(uname -m)" ;;
esac

# Set platform-specific variables
if [ "$OS_TYPE" = "darwin" ]; then
    platform="darwin-${arch}"
    APP_NAME="Rocket.app"
    INSTALL_DIR="/Applications"
    ext="zip"
    yml_file="latest-mac.yml"
else
    # Linux only supports x64 currently
    if [ "$arch" != "x64" ]; then
        error "Linux currently only supports x64 architecture. Your architecture: $arch"
    fi
    platform="linux-${arch}"
    APP_NAME="Rocket-x64.AppImage"
    INSTALL_DIR="$HOME/.local/bin"
    ext="AppImage"
    yml_file="latest-linux.yml"
fi

echo ""
info "Detected platform: $platform"

mkdir -p "$DOWNLOAD_DIR"
mkdir -p "$INSTALL_DIR"

# Fetch YAML manifest directly from /electron/latest/ (no version endpoint needed)
info "Fetching release info..."
manifest_yaml=$(download_file "$VERSIONS_URL/latest/$yml_file")

if [ -z "$manifest_yaml" ]; then
    error "Failed to fetch release info from $yml_file"
fi

# Extract version from YAML manifest
if [ "$HAS_YQ" = true ]; then
    version=$(echo "$manifest_yaml" | yq -r '.version // empty')
else
    version=$(echo "$manifest_yaml" | grep -m1 '^version:' | sed 's/^version:[[:space:]]*//')
fi

if [ -z "$version" ]; then
    error "Failed to extract version from manifest"
fi

info "Latest version: $version"

# Extract sha512 and filename for our architecture.
entry=$(get_entry_from_yaml "$manifest_yaml" "$arch") || true
IFS=$'\t' read -r filename checksum <<< "$entry"

# Validate checksum format (SHA-512 base64 is exactly 88 characters and ends in ==)
if ! printf '%s' "$checksum" | grep -Eq '^[A-Za-z0-9+/]{86}==$'; then
    error "Architecture $arch not found in $yml_file"
fi

# Only accept the canonical artifact name so a malformed manifest cannot write
# outside the download directory.
expected_filename="Rocket-${arch}.${ext}"
if [ "$filename" != "$expected_filename" ]; then
    error "Unexpected installer filename in $yml_file: $filename"
fi

info "Expected sha512: ${checksum:0:20}..."

# Download installer
installer_url="$VERSIONS_URL/latest/$filename"
installer_path="$DOWNLOAD_DIR/$filename"

info "Downloading $filename..."
echo ""
if ! download_file "$installer_url" "$installer_path" true; then
    rm -f "$installer_path"
    error "Download failed"
fi
echo ""

# Verify checksum (sha512, base64 encoded)
info "Verifying checksum..."
if [ "$OS_TYPE" = "darwin" ]; then
    # macOS: shasum outputs hex, convert to base64
    actual=$(shasum -a 512 "$installer_path" | cut -d' ' -f1 | xxd -r -p | base64)
else
    # Linux: sha512sum outputs hex, convert to base64
    actual=$(sha512sum "$installer_path" | cut -d' ' -f1 | xxd -r -p | base64 | tr -d '\n')
fi

if [ "$actual" != "$checksum" ]; then
    rm -f "$installer_path"
    error "Checksum verification failed\n  Expected: $checksum\n  Actual:   $actual"
fi

success "Checksum verified!"

# Platform-specific installation
if [ "$OS_TYPE" = "darwin" ]; then
    # macOS installation (from ZIP)
    zip_path="$installer_path"

    # Quit the app if it's running (use bundle ID for reliability)
    APP_BUNDLE_ID="com.rocket.research"
    if pgrep -x "Rocket" >/dev/null 2>&1; then
        info "Quitting Rocket..."
        osascript -e "tell application id \"$APP_BUNDLE_ID\" to quit" 2>/dev/null || true
        # Wait for app to quit (max 5 seconds) - POSIX compatible loop
        i=0
        while [ $i -lt 10 ]; do
            if ! pgrep -x "Rocket" >/dev/null 2>&1; then
                break
            fi
            sleep 0.5
            i=$((i + 1))
        done
        # Force kill if still running
        if pgrep -x "Rocket" >/dev/null 2>&1; then
            warn "App didn't quit gracefully. Force quitting (unsaved data may be lost)..."
            pkill -9 -x "Rocket" 2>/dev/null || true
            # Wait longer for macOS to release file handles
            sleep 3
        fi
    fi

    # Remove existing installation if present
    if [ -d "$INSTALL_DIR/$APP_NAME" ]; then
        info "Removing previous installation..."
        rm -rf "$INSTALL_DIR/$APP_NAME"
    fi

    # Extract ZIP to temp directory
    info "Extracting..."
    temp_dir=$(mktemp -d)
    if ! unzip -q "$zip_path" -d "$temp_dir"; then
        rm -rf "$temp_dir"
        rm -f "$zip_path"
        error "Failed to extract ZIP"
    fi

    # Find the .app in the extracted contents
    app_source=$(find "$temp_dir" -maxdepth 1 -name "*.app" -type d | head -1)

    if [ -z "$app_source" ]; then
        rm -rf "$temp_dir"
        rm -f "$zip_path"
        error "No .app found in ZIP"
    fi

    # Copy app to /Applications
    info "Installing to $INSTALL_DIR..."
    cp -R "$app_source" "$INSTALL_DIR/$APP_NAME"

    # Clean up
    info "Cleaning up..."
    rm -rf "$temp_dir"
    rm -f "$zip_path"

    # Remove quarantine attribute if present
    xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_NAME" 2>/dev/null || true

    echo ""
    echo "─────────────────────────────────────────────────────────────────────────"
    echo ""
    success "Installation complete!"
    echo ""
    printf "%b\n" "  Rocket has been installed to ${BOLD}$INSTALL_DIR/$APP_NAME${NC}"
    echo ""
    printf "%b\n" "  You can launch it from ${BOLD}Applications${NC} or by running:"
    printf "%b\n" "    ${BOLD}open -a 'Rocket'${NC}"
    echo ""

else
    # Linux installation
    appimage_path="$installer_path"

    # New paths
    APP_DIR="$HOME/.rocket/app"
    WRAPPER_PATH="$INSTALL_DIR/rocket"
    APPIMAGE_INSTALL_PATH="$APP_DIR/Rocket-x64.AppImage"

    # Kill the app if it's running
    if pgrep -f "Rocket.*AppImage" >/dev/null 2>&1; then
        info "Stopping Rocket..."
        pkill -f "Rocket.*AppImage" 2>/dev/null || true
        sleep 2
    fi

    # Create directories
    mkdir -p "$APP_DIR"
    mkdir -p "$INSTALL_DIR"

    # Remove existing AppImage
    [ -f "$APPIMAGE_INSTALL_PATH" ] && rm -f "$APPIMAGE_INSTALL_PATH"

    # Install AppImage
    info "Installing AppImage to $APP_DIR..."
    mv "$appimage_path" "$APPIMAGE_INSTALL_PATH"
    chmod +x "$APPIMAGE_INSTALL_PATH"

    # Create wrapper script
    info "Creating launcher at $WRAPPER_PATH..."
    cat > "$WRAPPER_PATH" << 'WRAPPER_EOF'
#!/bin/bash
# Rocket launcher - handles Linux-specific AppImage issues

APPIMAGE_PATH="$HOME/.rocket/app/Rocket-x64.AppImage"
ELECTRON_CACHE="$HOME/.config/@rocket"
ELECTRON_CACHE_ALT="$HOME/.cache/@rocket"

# Verify AppImage exists
if [ ! -f "$APPIMAGE_PATH" ]; then
    echo "Error: Rocket not found at $APPIMAGE_PATH"
    echo "Reinstall: curl -fsSL https://agents.rocket.app/install-app.sh | bash"
    exit 1
fi

# Ensure DISPLAY is set (required for X11)
if [ -z "$DISPLAY" ]; then
    export DISPLAY=:0.0
fi

# Clear stale cache referencing AppImage mount paths
# AppImage creates a new /tmp/.mount_Rocket-XXXX each launch, so any cached path is stale
for cache_dir in "$ELECTRON_CACHE" "$ELECTRON_CACHE_ALT"; do
    if [ -d "$cache_dir" ] && grep -rq '/tmp/\.mount_Rocket' "$cache_dir" 2>/dev/null; then
        rm -rf "$cache_dir"
    fi
done

# Set APPIMAGE for auto-update
export APPIMAGE="$APPIMAGE_PATH"

# Launch with --no-sandbox (AppImage extracts to /tmp, losing SUID on chrome-sandbox)
exec "$APPIMAGE_PATH" --no-sandbox "$@"
WRAPPER_EOF

    chmod +x "$WRAPPER_PATH"

    # Migrate old installation
    OLD_APPIMAGE="$INSTALL_DIR/Rocket-x64.AppImage"
    [ -f "$OLD_APPIMAGE" ] && rm -f "$OLD_APPIMAGE"

    echo ""
    echo "─────────────────────────────────────────────────────────────────────────"
    echo ""
    success "Installation complete!"
    echo ""
    printf "%b\n" "  AppImage: ${BOLD}$APPIMAGE_INSTALL_PATH${NC}"
    printf "%b\n" "  Launcher: ${BOLD}$WRAPPER_PATH${NC}"
    echo ""
    printf "%b\n" "  Run with: ${BOLD}rocket${NC}"
    echo ""
    printf "%b\n" "  Add to PATH if needed:"
    printf "%b\n" "    ${BOLD}echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc${NC}"
    echo ""

    # FUSE check
    if ! command -v fusermount >/dev/null 2>&1; then
        warn "FUSE required but not detected."
        printf "%b\n" "  Install: ${BOLD}sudo apt install fuse libfuse2${NC} (Debian/Ubuntu)"
        printf "%b\n" "           ${BOLD}sudo dnf install fuse fuse-libs${NC} (Fedora)"
    fi
fi
