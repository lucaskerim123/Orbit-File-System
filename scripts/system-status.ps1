[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$result = @{}
$PanelServiceName = if ($env:PANEL_SERVICE_NAME) { $env:PANEL_SERVICE_NAME } else { "MasterBrainPanel" }
$HiveDir = if ($env:HIVE_SERVER_DIR) { $env:HIVE_SERVER_DIR } else { "C:\mcp-hive-server" }
$HiveServerScript = Join-Path $HiveDir "server.js"
$SystemDriveName = if ($env:PANEL_SYSTEM_DRIVE) { $env:PANEL_SYSTEM_DRIVE } else { "C" }

$panelSvc = Get-Service -Name $PanelServiceName -ErrorAction SilentlyContinue
$result.panel = @{ status = if ($panelSvc) { $panelSvc.Status.ToString() } else { "NotFound" } }

try {
  $hiveProc = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop |
    Where-Object { $_.CommandLine -like ("*" + ($HiveServerScript -replace "\\", "\\") + "*") } |
    Select-Object -First 1
  $result.hive = @{ running = [bool]$hiveProc; processId = if ($hiveProc) { $hiveProc.ProcessId } else { $null } }
} catch {
  $result.hive = @{ running = $null; processId = $null; status = "Unknown" }
}

$tunnelProc = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
$result.tunnel = @{ running = [bool]$tunnelProc; processId = if ($tunnelProc) { $tunnelProc.Id } else { $null } }

try {
  $drive = Get-PSDrive $SystemDriveName -PSProvider FileSystem
  $result.disk = @{
    usedGB  = [math]::Round(($drive.Used / 1GB), 1)
    freeGB  = [math]::Round(($drive.Free / 1GB), 1)
    totalGB = [math]::Round((($drive.Used + $drive.Free) / 1GB), 1)
  }
} catch {
  $result.disk = @{
    usedGB  = $null
    freeGB  = $null
    totalGB = $null
    status  = "Unknown"
  }
}

$result | ConvertTo-Json -Depth 5 -Compress
