param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,

  [Parameter(Mandatory = $true)]
  [string]$OutputPath,

  [string]$ProgIds = "AutoCAD.Application,ZWCAD.Application"
)

$ErrorActionPreference = "Stop"

function Close-Doc {
  param($Doc)
  if ($null -ne $Doc) {
    try { $Doc.Close($false) | Out-Null } catch {}
  }
}

function Try-SaveAsDxf {
  param(
    [object]$Doc,
    [string]$Path
  )

  $saveTypes = @(65, 61, 49, 37, 25, 13, 1)
  foreach ($saveType in $saveTypes) {
    try {
      if (Test-Path -LiteralPath $Path) {
        Remove-Item -LiteralPath $Path -Force
      }
      $Doc.SaveAs($Path, $saveType) | Out-Null
      if (Test-Path -LiteralPath $Path) {
        return $true
      }
    } catch {}
  }

  try {
    if (Test-Path -LiteralPath $Path) {
      Remove-Item -LiteralPath $Path -Force
    }
    $Doc.SaveAs($Path) | Out-Null
    return Test-Path -LiteralPath $Path
  } catch {
    return $false
  }
}

if (-not (Test-Path -LiteralPath $InputPath)) {
  throw "Input DWG does not exist: $InputPath"
}

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$outputDir = Split-Path -Parent $OutputPath
if (-not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

$errors = New-Object System.Collections.Generic.List[string]
$progIdList = $ProgIds -split "," | ForEach-Object { $_.Trim() } | Where-Object { $_ }

foreach ($progId in $progIdList) {
  $app = $null
  $doc = $null
  try {
    $app = New-Object -ComObject $progId
    try { $app.Visible = $false } catch {}
    $doc = $app.Documents.Open($resolvedInput, $true)
    $saved = Try-SaveAsDxf -Doc $doc -Path $OutputPath
    Close-Doc -Doc $doc
    $doc = $null
    try { $app.Quit() | Out-Null } catch {}

    if ($saved -and (Test-Path -LiteralPath $OutputPath)) {
      $result = @{
        ok = $true
        progId = $progId
        outputPath = $OutputPath
      }
      $result | ConvertTo-Json -Compress
      exit 0
    }
    $errors.Add("${progId}: SaveAs did not produce DXF") | Out-Null
  } catch {
    $errors.Add("${progId}: $($_.Exception.Message)") | Out-Null
    Close-Doc -Doc $doc
    try {
      if ($null -ne $app) { $app.Quit() | Out-Null }
    } catch {}
  }
}

throw ("DWG conversion failed. " + ($errors -join " | "))
