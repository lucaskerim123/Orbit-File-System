from pathlib import Path
p = Path(r"F:\OrbitFS Project\OrbitFS-Panel\server.js")
s = p.read_text(encoding="utf-8")
old = '''app.post("/api/addons/:id/attach", requireAdmin, async (req,res) => {
  try {
    const component = ADDON_LICENSE_COMPONENTS[req.params.id];
    if (component && isLicenseEnforced()) await activateComponents(null, [component]);
    const addon = await attachAddon(req.params.id);
    logEvent("panel.addon.attached", { addon:req.params.id, user:req.username });
    res.json({ addon, addons:await currentAddonStatuses() });
  } catch (error) { res.status(error.status || 400).json({ error:error.message }); }
});'''
new = '''app.post("/api/addons/:id/attach", requireAdmin, async (req,res) => {
  try {
    const id = req.params.id;
    const before = await addonStatus(id).catch(() => null);
    const addon = before?.attached ? before : await attachAddon(id);
    const component = ADDON_LICENSE_COMPONENTS[id];
    if (component && isLicenseEnforced()) {
      try {
        await activateComponents(null, [component]);
      } catch (error) {
        if (!before?.attached) await detachAddon(id).catch(() => {});
        throw error;
      }
    }
    logEvent("panel.addon.attached", { addon:id, user:req.username });
    res.json({ ok:true, addon, addons:await currentAddonStatuses() });
  } catch (error) {
    res.status(error.status || 400).json({ error:error.message, code:error.code || "ADDON_ATTACH_FAILED", license:error.license || null });
  }
});'''
if old not in s:
    raise SystemExit('attach route block not found')
p.write_text(s.replace(old,new,1), encoding="utf-8")
print('PATCHED_WORKSPACE_ATTACH_SAFE')
