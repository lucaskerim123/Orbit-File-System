from pathlib import Path
p = Path(r"F:\OrbitFS Project\OrbitFS-Panel\server.js")
s = p.read_text(encoding="utf-8")
old = '''  if (target === "sorter") {
    const sorterLicense = await getComponentStatus(COMPONENTS.SORTER).catch(() => ({ licensed:false }));
    if (action !== "stop" && !sorterLicense.licensed) {
      return res.status(403).json({ error:"Sorter is blocked by licence. Stop is allowed; start/restart is blocked.", code:"LICENSE_REQUIRED", license:sorterLicense });
    }
    if (action !== "stop" && !(await addonEnabled("sorter"))) {
      return res.status(409).json({ error:"Attach the Sorter addon in Config before starting it." });
    }
  }
  if (target === "hive") {
    const mcpLicense = await getComponentStatus(COMPONENTS.MCP).catch(() => ({ licensed:false }));
    if (action !== "stop" && !mcpLicense.licensed) {
      return res.status(403).json({ error:"MCP is blocked by licence. Stop is allowed; start/restart is blocked.", code:"LICENSE_REQUIRED", license:mcpLicense });
    }
  }
'''
new = '''  if (target === "sorter") {
    const sorterLicense = await getComponentStatus(COMPONENTS.SORTER, { refresh: action !== "stop" }).catch((error) => ({ licensed:false, error:error.message }));
    if (action !== "stop" && !sorterLicense.licensed) {
      stopWindowsServiceIfRunning(SORTER_SERVICE_NAME, "sorter_license_blocked_start_attempt");
      return res.status(403).json({ error:"Sorter is blocked by licence. Stop is allowed; start/restart is blocked.", code:"LICENSE_REQUIRED", license:sorterLicense });
    }
    if (action !== "stop" && !(await addonEnabled("sorter"))) {
      return res.status(409).json({ error:"Attach the Sorter addon in Config before starting it." });
    }
  }
  if (target === "hive") {
    const mcpLicense = await getComponentStatus(COMPONENTS.MCP, { refresh: action !== "stop" }).catch((error) => ({ licensed:false, error:error.message }));
    if (action !== "stop" && !mcpLicense.licensed) {
      stopWindowsServiceIfRunning(HIVE_SERVICE_NAME, "mcp_license_blocked_start_attempt");
      return res.status(403).json({ error:"MCP is blocked by licence. Stop is allowed; start/restart is blocked.", code:"LICENSE_REQUIRED", license:mcpLicense });
    }
  }
'''
if old not in s:
    raise SystemExit('control gate block not found')
s = s.replace(old, new, 1)
# make status endpoint refresh licence states too
s = s.replace('const sorterLicense = await getComponentStatus(COMPONENTS.SORTER).catch(() => ({ licensed:false }));', 'const sorterLicense = await getComponentStatus(COMPONENTS.SORTER, { refresh:true }).catch(() => ({ licensed:false }));', 1)
s = s.replace('const mcpLicense = await getComponentStatus(COMPONENTS.MCP).catch(() => ({ licensed:false }));', 'const mcpLicense = await getComponentStatus(COMPONENTS.MCP, { refresh:true }).catch(() => ({ licensed:false }));', 1)
p.write_text(s, encoding="utf-8")
print("PATCHED_START_RESTART_REFRESH_CHECK")