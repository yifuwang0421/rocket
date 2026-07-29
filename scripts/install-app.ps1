# Rocket Windows Installer
# Usage: irm https://agents.rocket.app/install-app.ps1 | iex

& {
$ErrorActionPreference = "Stop"

$VERSIONS_URL = "https://agents.rocket.app/electron"
$DOWNLOAD_DIR = Join-Path ([System.IO.Path]::GetTempPath()) (
    "rocket-install-" + [Guid]::NewGuid().ToString("N")
)
$APP_NAME = "Rocket"

# Colors for output
function Write-Info { Write-Host "> $args" -ForegroundColor Blue }
function Write-Success { Write-Host "> $args" -ForegroundColor Green }
function Write-Warn { Write-Host "! $args" -ForegroundColor Yellow }
function Remove-InstallerTemp {
    if ($DOWNLOAD_DIR -and (Test-Path -LiteralPath $DOWNLOAD_DIR)) {
        Remove-Item -LiteralPath $DOWNLOAD_DIR -Recurse -Force -ErrorAction SilentlyContinue
    }
}
function Write-Err {
    Remove-InstallerTemp
    Write-Host "x $args" -ForegroundColor Red
    exit 1
}

# Check for Windows
if ($env:OS -ne "Windows_NT") {
    Write-Err "This installer is for Windows only."
}

# Detect architecture
$arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
$platform = "win32-$arch"

Write-Host ""
Write-Info "Detected platform: $platform (arch: $arch)"

# Create download directory
New-Item -ItemType Directory -Force -Path $DOWNLOAD_DIR | Out-Null

try {
# Fetch YAML manifest directly from /electron/latest/ (no version endpoint needed)
Write-Info "Fetching release info..."
$yamlPath = Join-Path $DOWNLOAD_DIR "latest.yml"
try {
    Invoke-WebRequest -Uri "$VERSIONS_URL/latest/latest.yml" -OutFile $yamlPath -UseBasicParsing
} catch {
    Write-Err "Failed to fetch release info: $_"
}

$yamlContent = Get-Content $yamlPath -Raw
if (-not $yamlContent) {
    Write-Err "Failed to fetch release info from latest.yml"
}

# Extract version from YAML manifest
$version = $null
if ($yamlContent -match '(?m)^version:\s*(.+)') {
    $version = $Matches[1].Trim()
}

if (-not $version) {
    Write-Err "Failed to extract version from manifest"
}

Write-Info "Latest version: $version"

# Parse YAML to extract sha512, url (filename), and size for our architecture
# YAML format:
#   files:
#     - url: Rocket-x64.exe
#       sha512: <base64>
#       size: 123456789
#       arch: x64
function Get-YamlEntryForArch {
    param([string]$yaml, [string]$targetArch)
    $lines = $yaml -split "`n"
    $currentUrl = $null
    $currentSha512 = $null
    $currentSize = $null
    $currentArch = $null
    $entries = @()

    foreach ($line in $lines) {
        if ($line -match '^\s*-\s*url:\s*(.+)') {
            if ($currentUrl -and $currentSha512) {
                $entries += @{
                    url = $currentUrl
                    sha512 = $currentSha512
                    size = $currentSize
                    arch = $currentArch
                }
            }
            $currentUrl = $Matches[1].Trim()
            $currentSha512 = $null
            $currentSize = $null
            $currentArch = $null
        }
        if ($line -match '^\s*sha512:\s*(.+)') {
            $currentSha512 = $Matches[1].Trim()
        }
        if ($line -match '^\s*size:\s*(\d+)') {
            $currentSize = [long]$Matches[1]
        }
        if ($line -match '^\s*arch:\s*(.+)') {
            $currentArch = $Matches[1].Trim()
        }
    }

    if ($currentUrl -and $currentSha512) {
        $entries += @{
            url = $currentUrl
            sha512 = $currentSha512
            size = $currentSize
            arch = $currentArch
        }
    }

    # electron-builder's single-architecture latest.yml does not include an
    # explicit `arch:` field. Prefer explicit metadata when present, then the
    # canonical artifact filename, and finally a single unambiguous entry.
    $match = $entries | Where-Object { $_.arch -eq $targetArch } | Select-Object -First 1
    if (-not $match) {
        $archPattern = "(^|[-_.])$([regex]::Escape($targetArch))([-_.]|$)"
        $match = $entries | Where-Object { $_.url -match $archPattern } | Select-Object -First 1
    }
    if (-not $match -and $entries.Count -eq 1) {
        $match = $entries[0]
    }

    if ($match) {
        return @{ url = $match.url; sha512 = $match.sha512; size = $match.size }
    }
    return $null
}

$entry = Get-YamlEntryForArch -yaml $yamlContent -targetArch $arch

if (-not $entry) {
    Write-Err "Architecture $arch not found in latest.yml"
}

$checksum = $entry.sha512
$filename = $entry.url
$fileSize = $entry.size

# Validate checksum format (SHA-512 base64 = 88 characters)
if (-not $checksum -or $checksum -notmatch '^[A-Za-z0-9+/]{86}==$') {
    Write-Err "Invalid checksum in manifest"
}

# Only accept the canonical artifact name. This prevents a compromised or
# malformed manifest from writing outside the download directory.
$expectedFilename = "Rocket-$arch.exe"
if ($filename -ne $expectedFilename) {
    Write-Err "Unexpected installer filename in manifest: $filename"
}

if (-not $fileSize -or $fileSize -le 0) {
    Write-Err "Invalid installer size in manifest"
}

$installerUrl = "$VERSIONS_URL/latest/$filename"

Write-Info "Expected sha512: $($checksum.Substring(0, 20))..."

# Download installer with progress
$installerPath = Join-Path $DOWNLOAD_DIR $filename
$fileSizeMB = if ($fileSize -gt 0) { [math]::Round($fileSize / 1MB, 1) } else { 0 }

# Clean up any partial download from previous attempts
Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue

Write-Info "Downloading $filename ($fileSizeMB MB)..."

try {
    # Use WebRequest for download with progress
    $webRequest = [System.Net.HttpWebRequest]::Create($installerUrl)
    $webRequest.Timeout = 600000  # 10 minutes
    $response = $webRequest.GetResponse()
    $responseStream = $response.GetResponseStream()
    $fileStream = [System.IO.File]::Create($installerPath)

    $buffer = New-Object byte[] 65536
    $totalRead = 0
    $lastPercent = -1

    while (($read = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
        $fileStream.Write($buffer, 0, $read)
        $totalRead += $read

        if ($fileSize -gt 0) {
            $percent = [math]::Floor(($totalRead / $fileSize) * 100)
            if ($percent -ne $lastPercent) {
                $downloadedMB = [math]::Round($totalRead / 1MB, 1)
                $barWidth = 40
                # Cap at 100% for display (actual download may exceed manifest size slightly)
                $displayPercent = [math]::Min($percent, 100)
                $filled = [math]::Min([math]::Floor($displayPercent / (100 / $barWidth)), $barWidth)
                $bar = "[" + ("#" * $filled) + ("-" * ($barWidth - $filled)) + "]"
                Write-Host -NoNewline ("`r  $bar $percent% ($downloadedMB / $fileSizeMB MB)   ")
                $lastPercent = $percent
            }
        }
    }

    $fileStream.Close()
    $responseStream.Close()
    $response.Close()

    Write-Host ""
    Write-Success "Download complete!"
} catch {
    # Clean up partial download on failure
    if ($fileStream) { $fileStream.Close() }
    if ($responseStream) { $responseStream.Close() }
    if ($response) { $response.Close() }
    Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
    Write-Err "Download failed: $_"
}

# Verify file was downloaded
if (-not (Test-Path $installerPath)) {
    Write-Err "Download failed: file not found"
}

$downloadedSize = (Get-Item -LiteralPath $installerPath).Length
if ($downloadedSize -ne $fileSize) {
    Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue
    Write-Err "Downloaded size does not match manifest`n  Expected: $fileSize`n  Actual:   $downloadedSize"
}

# Verify checksum (SHA-512, base64 encoded — matches electron-builder YAML manifest)
Write-Info "Verifying checksum..."
$sha512 = [System.Security.Cryptography.SHA512]::Create()
$stream = [System.IO.File]::OpenRead($installerPath)
$hashBytes = $sha512.ComputeHash($stream)
$stream.Close()
$sha512.Dispose()
$actualHash = [Convert]::ToBase64String($hashBytes)

if ($actualHash -ne $checksum) {
    Remove-Item -Path $installerPath -Force -ErrorAction SilentlyContinue
    Write-Err "Checksum verification failed`n  Expected: $checksum`n  Actual:   $actualHash"
}

Write-Success "Checksum verified!"

# A checksum from the same release endpoint protects against transfer errors,
# while Authenticode independently proves that the installer was signed by a
# trusted publisher.
Write-Info "Verifying Authenticode signature..."
$installerSignature = Get-AuthenticodeSignature -LiteralPath $installerPath
if ($installerSignature.Status -ne "Valid" -or -not $installerSignature.SignerCertificate) {
    Remove-Item -LiteralPath $installerPath -Force -ErrorAction SilentlyContinue
    Write-Err "Installer Authenticode signature is not valid: $($installerSignature.Status)"
}
Write-Success "Authenticode signature verified: $($installerSignature.SignerCertificate.Subject)"

# Close the app gracefully before falling back to a forced stop.
$processes = @(Get-Process -Name "Rocket" -ErrorAction SilentlyContinue)
if ($processes.Count -gt 0) {
    Write-Info "Closing Rocket..."
    foreach ($runningProcess in $processes) {
        if ($runningProcess.MainWindowHandle -ne 0) {
            $null = $runningProcess.CloseMainWindow()
        }
    }
    $deadline = [DateTime]::UtcNow.AddSeconds(10)
    do {
        Start-Sleep -Milliseconds 250
        $remainingProcesses = @(Get-Process -Name "Rocket" -ErrorAction SilentlyContinue)
    } while ($remainingProcesses.Count -gt 0 -and [DateTime]::UtcNow -lt $deadline)

    if ($remainingProcesses.Count -gt 0) {
        Write-Warn "Rocket did not exit within 10 seconds; forcing it to close."
        $remainingProcesses | Stop-Process -Force
        Start-Sleep -Seconds 1
    }
}

# Run the installer
Write-Info "Running installer (follow the installer prompts)..."

try {
    $installerProcess = Start-Process -FilePath $installerPath -PassThru
    $spinner = @('|', '/', '-', '\')
    $i = 0

    while (-not $installerProcess.HasExited) {
        Write-Host -NoNewline ("`r  Installing... " + $spinner[$i % 4] + "   ")
        Start-Sleep -Milliseconds 200
        $i++
    }

    Write-Host -NoNewline "`r                      `r"

    if ($installerProcess.ExitCode -ne 0) {
        Write-Err "Installation failed with exit code: $($installerProcess.ExitCode)"
    }
} catch {
    Write-Err "Installation failed: $_"
}

$installedExePath = "$env:LOCALAPPDATA\Programs\Rocket\Rocket.exe"
if (-not (Test-Path -LiteralPath $installedExePath)) {
    Write-Err "Installed Rocket executable was not found: $installedExePath"
}
$installedSignature = Get-AuthenticodeSignature -LiteralPath $installedExePath
if ($installedSignature.Status -ne "Valid" -or -not $installedSignature.SignerCertificate) {
    Write-Err "Installed Rocket Authenticode signature is not valid: $($installedSignature.Status)"
}
Write-Success "Installed Rocket signature verified!"

# Clean up the unique installer workspace.
Write-Info "Cleaning up..."
Remove-InstallerTemp

Write-Host ""
Write-Host "---------------------------------------------------------------------"
Write-Host ""
Write-Success "Installation complete!"
Write-Host ""
Write-Host "  Rocket has been installed."
Write-Host ""
Write-Host "  Launch from:"
Write-Host "    - Start Menu or desktop shortcut"
Write-Host ""
} finally {
    Remove-InstallerTemp
}
}
