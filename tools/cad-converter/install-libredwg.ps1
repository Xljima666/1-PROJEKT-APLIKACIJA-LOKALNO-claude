$ErrorActionPreference = "Stop"

$version = "0.13.4"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$vendor = Join-Path $root "vendor"
$zip = Join-Path $vendor "libredwg-$version-win64.zip"
$url = "https://github.com/LibreDWG/libredwg/releases/download/$version/libredwg-$version-win64.zip"

New-Item -ItemType Directory -Path $vendor -Force | Out-Null

if (-not (Test-Path -LiteralPath $zip)) {
  Write-Host "Downloading LibreDWG $version..."
  Invoke-WebRequest -Uri $url -OutFile $zip
}

$extractDir = Join-Path $vendor "libredwg-$version-win64"
if (-not (Test-Path -LiteralPath $extractDir)) {
  Write-Host "Extracting LibreDWG..."
  Expand-Archive -LiteralPath $zip -DestinationPath $extractDir -Force
}

$dwg2dxf = Get-ChildItem -LiteralPath $extractDir -Recurse -Filter "dwg2dxf.exe" | Select-Object -First 1
if (-not $dwg2dxf) {
  throw "dwg2dxf.exe was not found after extraction."
}

Write-Host "LibreDWG ready: $($dwg2dxf.FullName)"
