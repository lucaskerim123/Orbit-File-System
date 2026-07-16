from pathlib import Path
p=Path(r"F:\OrbitFS Project\OrbitFS-Panel\server.js")
s=p.read_text(encoding='utf-8')
old='''  if (target === "sorter") {
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
new='''  if (target === "sorter") {
    if (action !== "stop") {
      if (!(await addonEnabled("sorter"))) {
        return res.status(409).json({ error:"Attach the Sorter addon in Config before starting it." });
      }
      try {
        await activateComponents(null, [COMPONENTS.SORTER]);
      } catch (error) {
        stopWindowsServiceIfRunning(SORTER_SERVICE_NAME, "sorter_license_blocked_start_attempt");
        return res.status(error.status || 403).json({
          error:"Sorter is blocked by licence. Stop is allowed; start/restart is blocked.",
          code:error.code || "LICENSE_REQUIRED",
          license:error.license || null,
        });
      }
    }
  }
  if (target === "hive") {
    if (action !== "stop") {
      try {
        await activateComponents(null, [COMPONENTS.MCP]);
      } catch (error) {
        stopWindowsServiceIfRunning(HIVE_SERVICE_NAME, "mcp_license_blocked_start_attempt");
        return res.status(error.status || 403).json({
          error:"MCP is blocked by licence. Stop is allowed; start/restart is blocked.",
          code:error.code || "LICENSE_REQUIRED",
          license:error.license || null,
        });
      }
    }
  }
'''
if old not in s:
    raise SystemExit('target control block not found')
p.write_text(s.replace(old,new,1),encoding='utf-8')
print('PATCHED_START_BIND_COMPONENTS')