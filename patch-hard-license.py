from pathlib import Path
p = Path(r"F:\OrbitFS Project\OrbitFS-Panel\server.js")
s = p.read_text(encoding="utf-8")
# Move heartbeat start until after logError is declared.
s = s.replace('startLicenseHeartbeat({ onUpdate: enforceLicensedServices, onError: (error) => logError("license.heartbeat", error) });\n\nconst POWERSHELL_CANDIDATES', 'const POWERSHELL_CANDIDATES', 1)
insert_after = '''function logError(event, err, fields = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, error: err.message, ...fields });
  console.error(line);
  fs.mkdir(LOG_DIR, { recursive: true })
    .then(() => fs.appendFile(PANEL_ERROR_LOG, `${line}\n`))
    .catch(() => {});
}
'''
heartbeat = insert_after + '\nstartLicenseHeartbeat({ onUpdate: enforceLicensedServices, onError: (error) => logError("license.heartbeat", error) });\n'
if 'startLicenseHeartbeat({ onUpdate: enforceLicensedServices' not in s:
    s = s.replace(insert_after, heartbeat, 1)
# Allow stop while blocking start/restart for unlicensed sorter and MCP/hive.
s = s.replace('''  if (target === "sorter") {
    const sorterLicense = await getComponentStatus(COMPONENTS.SORTER).catch(() => ({ licensed:false }));
    if (!sorterLicense.licensed) {
      return res.status(403).json({ error:"Sorter is blocked by licence.", code:"LICENSE_REQUIRED", license:sorterLicense });
    }
    if (action !== "stop" && !(await addonEnabled("sorter"))) {
      return res.status(409).json({ error:"Attach the Sorter addon in Config before starting it." });
    }
  }
  if (target === "hive") {
    const mcpLicense = await getComponentStatus(COMPONENTS.MCP).catch(() => ({ licensed:false }));
    if (!mcpLicense.licensed) {
      return res.status(403).json({ error:"MCP is blocked by licence.", code:"LICENSE_REQUIRED", license:mcpLicense });
    }
  }
''', '''  if (target === "sorter") {
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
''', 1)
p.write_text(s, encoding="utf-8")
print("PATCHED_HARD_LICENSE_SERVER")