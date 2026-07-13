[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $repoRoot "runtime\remote-desktop-commander-task"
$logDir = Join-Path $runtime "logs"
$firstLinkLog = Join-Path $logDir "first-link.log"
$sessionPath = Join-Path $runtime "current-session-id.txt"
$urlPath = Join-Path $runtime "current-add-device-url.txt"

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Save-SessionFromText {
  param([string]$Text)

  $urlMatch = [regex]::Match($Text, 'https://mcp\.desktopcommander\.app/add-device\?session_id=([A-Za-z0-9._~%+-]+)')
  if ($urlMatch.Success) {
    $url = $urlMatch.Value
    $sessionId = $urlMatch.Groups[1].Value
    Set-Content -LiteralPath $urlPath -Value $url -Encoding UTF8
    Set-Content -LiteralPath $sessionPath -Value $sessionId -Encoding UTF8
    try { Set-Clipboard -Value $url } catch {}
    Write-Host ""
    Write-Host "RELINK / ADD DEVICE URL"
    Write-Host "-----------------------"
    Write-Host $url
    Write-Host ""
    Write-Host "SESSION ID"
    Write-Host "----------"
    Write-Host $sessionId
    Write-Host ""
    Write-Host "Saved to: $sessionPath"
    return $true
  }
  return $false
}

Write-Host "Running first-link command:"
Write-Host "npx @wonderwhy-er/desktop-commander@latest remote"
Write-Host ""
Write-Host "Complete the add-device browser page when it opens."
Write-Host "Leave this window open. Press Ctrl+C only after it is linked."
Write-Host ""

Add-Content -LiteralPath $firstLinkLog -Value "`n===== first link started $(Get-Date -Format o) ====="

try {
  & npx @wonderwhy-er/desktop-commander@latest remote 2>&1 | Tee-Object -FilePath $firstLinkLog -Append
} finally {
  Add-Content -LiteralPath $firstLinkLog -Value "===== first link ended $(Get-Date -Format o) ====="
  $text = ""
  if (Test-Path -LiteralPath $firstLinkLog) {
    $text = Get-Content -LiteralPath $firstLinkLog -Raw -ErrorAction SilentlyContinue
  }
  if (-not (Save-SessionFromText -Text $text)) {
    Write-Host ""
    Write-Host "No add-device URL/session ID was found in the first-link log."
    Write-Host "Log: $firstLinkLog"
  }
}
