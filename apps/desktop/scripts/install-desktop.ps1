# Install Data Explorer from the GitHub Release that stamped this script.
# Usage:
#   irm __INSTALL_PS1_URL__ | iex
$ErrorActionPreference = 'Stop'

$AppVersion = '__APP_VERSION__'
$AppTag = '__APP_TAG__'
$Repo = '__REPO__'

if ($AppVersion.StartsWith('__')) {
  Write-Error "Download from a GitHub Release: irm https://github.com/midrissi/4d-dataexplorer/releases/latest/download/install-desktop.ps1 | iex"
}

Write-Host ""
Write-Host "Data Explorer — install $AppTag"
Write-Host "--------------------------------"

$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/tags/$AppTag" -Headers @{
  Accept = 'application/vnd.github+json'
  'User-Agent' = 'DataExplorer-install'
}

$asset = $release.assets |
  Where-Object {
    $_.name -match '\.(msi|exe)$' -and
    $_.name -notmatch '\.sig$' -and
    $_.name -notmatch '\.sha256$'
  } |
  Select-Object -First 1

if (-not $asset) {
  Write-Host "No Windows installer found for $AppTag"
  Write-Host "Open: https://github.com/$Repo/releases/tag/$AppTag"
  exit 1
}

$ext = [IO.Path]::GetExtension($asset.name)
$out = Join-Path $env:TEMP "DataExplorer-setup$ext"
Write-Host "Downloading $($asset.name) ..."
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $out -UseBasicParsing
Write-Host "Starting installer..."
Start-Process $out
Write-Host ""
Write-Host "Done. Complete the installer UI if prompted."
