param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("hive", "tunnel", "panel")]
  [string]$Target
)

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

switch ($Target) {
  "hive" {
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
      Where-Object { $_.CommandLine -like "*mcp-hive-server*server.js*" } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
    Start-Process -FilePath "node" -ArgumentList "C:\mcp-hive-server\server.js" `
      -WorkingDirectory "C:\mcp-hive-server" `
      -RedirectStandardOutput "C:\mcp-hive-server\out.log" `
      -RedirectStandardError "C:\mcp-hive-server\err.log" -WindowStyle Hidden
    Write-Output '{"ok":true}'
  }
  "tunnel" {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 1
    Start-Process -FilePath "C:\cloudflared\cloudflared.exe" `
      -ArgumentList '--config "C:\Users\Lucas\.cloudflared\config.yml" tunnel run master-hive' `
      -RedirectStandardOutput "C:\cloudflared\tunnel_out.log" `
      -RedirectStandardError "C:\cloudflared\tunnel_err.log" -WindowStyle Hidden
    Write-Output '{"ok":true}'
  }
  "panel" {
    # Called detached from server.js after it has already responded to the
    # HTTP request, since this kills the very process serving that request.
    Start-Sleep -Seconds 1
    Restart-Service -Name MasterBrainPanel -Force
  }
}
