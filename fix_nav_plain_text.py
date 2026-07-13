from pathlib import Path
root = Path(r"F:\OrbitFS Project\OrbitFS-Panel")

p = root / "public" / "index.html"
s = p.read_text(encoding="utf-8", errors="replace")
start = s.index('    <nav class="tabs">')
end = s.index('    </nav>', start) + len('    </nav>')
nav = '''    <nav class="tabs">
      <button class="tab-btn" id="tab-btn-account" data-tab="account">Account</button>
      <button class="tab-btn active" data-tab="files">Files</button>
      <button class="tab-btn" id="tab-btn-workspaces" data-tab="workspaces">Workspace Manager</button>
      <button class="tab-btn hidden" id="tab-btn-sorter" data-tab="sorter">Sorter</button>
      <button class="tab-btn hidden" id="tab-btn-system" data-tab="system">System</button>
      <button class="tab-btn hidden" id="tab-btn-admin" data-tab="admin">Admin</button>
    </nav>'''
s = s[:start] + nav + s[end:]
s = s.replace('<section id="tab-files" class="tab-panel">','<section id="tab-files" class="tab-panel active">',1)
s = s.replace('<section id="tab-account" class="tab-panel workspace-panel active">','<section id="tab-account" class="tab-panel workspace-panel">',1)
p.write_text(s, encoding="utf-8")

p = root / "public" / "app.js"
s = p.read_text(encoding="utf-8", errors="replace")
show_start = s.index('function showApp()')
show_end = s.index('\n}', show_start) + 2
block = s[show_start:show_end]
block = block.replace('switchTab("account");','switchTab("files");')
block = block.replace('loadAccountPanel();','loadFiles();')
s = s[:show_start] + block + s[show_end:]
p.write_text(s, encoding="utf-8")
print("plain navigation and Files homepage applied")