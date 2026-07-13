from pathlib import Path
p=Path(r"F:\OrbitFS Project\OrbitFS-Panel\public\app.js")
s=p.read_text(encoding='utf-8-sig')
s=s.replace('''  document.getElementById("tab-btn-system").classList.toggle("hidden", state.role !== "admin");''','''  document.getElementById("tab-btn-system").classList.toggle("hidden", state.role !== "admin");
  document.getElementById("tab-btn-admin")?.classList.toggle("hidden", state.role !== "admin");
  const adminZone = document.querySelector("#tab-system .sys-zone-admin");
  const adminHost = document.getElementById("admin-zone-host");
  if (adminZone && adminHost && adminZone.parentElement !== adminHost) adminHost.appendChild(adminZone);
  switchTab("account");
  loadAccountPanel();''',1)
s=s.replace('''  if (tabName === "system") loadSystem();
  if (tabName === "sorter") sorterLoad();''','''  if (tabName === "system" || tabName === "admin") loadSystem();
  if (tabName === "account") loadAccountPanel();
  if (tabName === "sorter") sorterLoad();''',1)
if 'admin-refresh-btn' not in s:
    s += '''

document.getElementById("admin-refresh-btn")?.addEventListener("click", loadSystem);
'''
p.write_text(s,encoding='utf-8')
print('admin tab wiring applied')