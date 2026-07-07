[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$result = @{}

$panelSvc = Get-Service -Name MasterBrainPanel -ErrorAction SilentlyContinue
$result.panel = @{ status = if ($panelSvc) { $panelSvc.Status.ToString() } else { "NotFound" } }

$hiveProc = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*mcp-hive-server*server.js*" } | Select-Object -First 1
$result.hive = @{ running = [bool]$hiveProc; processId = if ($hiveProc) { $hiveProc.ProcessId } else { $null } }

$tunnelProc = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
$result.tunnel = @{ running = [bool]$tunnelProc; processId = if ($tunnelProc) { $tunnelProc.Id } else { $null } }

$drive = Get-PSDrive C -PSProvider FileSystem
$result.disk = @{
  usedGB  = [math]::Round(($drive.Used / 1GB), 1)
  freeGB  = [math]::Round(($drive.Free / 1GB), 1)
  totalGB = [math]::Round((($drive.Used + $drive.Free) / 1GB), 1)
}

$result | ConvertTo-Json -Depth 5 -Compress
