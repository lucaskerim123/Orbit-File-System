param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("hive", "tunnel", "panel")]
  [string]$Target,

  [ValidateSet("start", "stop", "restart")]
  [string]$Action = "restart",

  [string]$PanelServiceName = $(if ($env:PANEL_SERVICE_NAME) { $env:PANEL_SERVICE_NAME } else { "MasterBrainPanel" }),

  [string]$HiveDir = $(if ($env:HIVE_SERVER_DIR) { $env:HIVE_SERVER_DIR } else { "C:\mcp-hive-server" }),

  [string]$CloudflaredDir = $(if ($env:CLOUDFLARED_DIR) { $env:CLOUDFLARED_DIR } else { "C:\cloudflared" })
)

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$HiveServerScript = Join-Path $HiveDir "server.js"
$HiveOutLog = Join-Path $HiveDir "out.log"
$HiveErrLog = Join-Path $HiveDir "err.log"
$CloudflaredExe = if ($env:CLOUDFLARED_EXE) { $env:CLOUDFLARED_EXE } else { Join-Path $CloudflaredDir "cloudflared.exe" }
$CloudflaredConfig = if ($env:CLOUDFLARED_CONFIG) { $env:CLOUDFLARED_CONFIG } else { Join-Path $HOME ".cloudflared\config.yml" }
$CloudflaredTunnelName = if ($env:CLOUDFLARED_TUNNEL_NAME) { $env:CLOUDFLARED_TUNNEL_NAME } else { "master-hive" }

function Get-HiveProcesses {
  try {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -like (Get-HiveCommandPattern) }
  } catch {
    @()
  }
}

function Get-HiveCommandPattern {
  return "*" + ($HiveServerScript -replace "\\", "\\") + "*"
}

function Start-BackgroundCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,

    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,

    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,

    [Parameter(Mandatory = $true)]
    [string]$StdoutPath,

    [Parameter(Mandatory = $true)]
    [string]$StderrPath
  )

  function Quote-Arg([string]$value) {
    if ($value -match '[\s"]') {
      return '"' + ($value -replace '"', '\"') + '"'
    }
    return $value
  }

  function Resolve-WritableLogPath([string]$preferredPath, [string]$fallbackName) {
    try {
      $dir = Split-Path -Parent $preferredPath
      if ($dir) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
      }
      $test = [System.IO.File]::Open($preferredPath, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write, [System.IO.FileShare]::ReadWrite)
      $test.Dispose()
      return $preferredPath
    } catch {
      $fallbackDir = Join-Path $env:TEMP "master-brain"
      New-Item -ItemType Directory -Force -Path $fallbackDir | Out-Null
      return (Join-Path $fallbackDir $fallbackName)
    }
  }

  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $Executable
  $psi.Arguments = ($Arguments | ForEach-Object { Quote-Arg $_ }) -join " "
  $psi.WorkingDirectory = $WorkingDirectory
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true

  $proc = New-Object System.Diagnostics.Process
  $proc.StartInfo = $psi
  if (-not $proc.Start()) {
    throw "Failed to start $Executable"
  }

  $StdoutPath = Resolve-WritableLogPath $StdoutPath "stdout.log"
  $StderrPath = Resolve-WritableLogPath $StderrPath "stderr.log"
  $stdoutWriter = [System.IO.StreamWriter]::new($StdoutPath, $true, [System.Text.UTF8Encoding]::new($false))
  $stderrWriter = [System.IO.StreamWriter]::new($StderrPath, $true, [System.Text.UTF8Encoding]::new($false))

  Register-ObjectEvent -InputObject $proc -EventName OutputDataReceived -Action {
    if ($EventArgs.Data) { $stdoutWriter.WriteLine($EventArgs.Data); $stdoutWriter.Flush() }
  } | Out-Null
  Register-ObjectEvent -InputObject $proc -EventName ErrorDataReceived -Action {
    if ($EventArgs.Data) { $stderrWriter.WriteLine($EventArgs.Data); $stderrWriter.Flush() }
  } | Out-Null
  Register-ObjectEvent -InputObject $proc -EventName Exited -Action {
    $stdoutWriter.Dispose()
    $stderrWriter.Dispose()
  } | Out-Null

  $proc.EnableRaisingEvents = $true
  $proc.BeginOutputReadLine()
  $proc.BeginErrorReadLine()
}

function Stop-HiveProcess {
  Get-HiveProcesses | ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Start-HiveProcess {
  $running = Get-HiveProcesses
  if (-not $running) {
    Start-BackgroundCommand `
      -Executable "node" `
      -Arguments @($HiveServerScript) `
      -WorkingDirectory $HiveDir `
      -StdoutPath $HiveOutLog `
      -StderrPath $HiveErrLog
  }
}

function Stop-TunnelProcess {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
}

function Start-TunnelProcess {
  $running = Get-Process cloudflared -ErrorAction SilentlyContinue
  if (-not $running) {
    Start-BackgroundCommand `
      -Executable $CloudflaredExe `
      -Arguments @("--config", $CloudflaredConfig, "tunnel", "run", $CloudflaredTunnelName) `
      -WorkingDirectory $CloudflaredDir `
      -StdoutPath (Join-Path $CloudflaredDir "tunnel_out.log") `
      -StderrPath (Join-Path $CloudflaredDir "tunnel_err.log")
  }
}

# panel stop/restart are called detached from server.js after it has already
# responded to the HTTP request, since both kill the very process serving
# that request. panel start is called synchronously - the service is already
# stopped in that case, so there's no request to lose.
switch ("$Target.$Action") {
  "hive.start"     { Start-HiveProcess }
  "hive.stop"      { Stop-HiveProcess }
  "hive.restart"   { Stop-HiveProcess; Start-Sleep -Seconds 1; Start-HiveProcess }

  "tunnel.start"   { Start-TunnelProcess }
  "tunnel.stop"    { Stop-TunnelProcess }
  "tunnel.restart" { Stop-TunnelProcess; Start-Sleep -Seconds 1; Start-TunnelProcess }

  "panel.start"    { Start-Service -Name $PanelServiceName }
  "panel.stop"     { Start-Sleep -Seconds 1; Stop-Service -Name $PanelServiceName -Force }
  "panel.restart"  { Start-Sleep -Seconds 1; Restart-Service -Name $PanelServiceName -Force }
}

Write-Output '{"ok":true}'
