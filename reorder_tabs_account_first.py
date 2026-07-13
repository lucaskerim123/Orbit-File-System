from pathlib import Path
p=Path(r"F:\OrbitFS Project\OrbitFS-Panel\public\index.html")
s=p.read_text(encoding='utf-8-sig')
old='''    <nav class="tabs">
      <button class="tab-btn active" data-tab="files">📁 Files</button>
      <button class="tab-btn hidden" id="tab-btn-sorter" data-tab="sorter">🧹 Sorter</button>
      <button class="tab-btn" id="tab-btn-workspaces" data-tab="workspaces">🗂️ Workspaces</button>
      <button class="tab-btn" id="tab-btn-account" data-tab="account">👤 Account</button>
      <button class="tab-btn hidden" id="tab-btn-system" data-tab="system">🖥️ System</button>
    </nav>'''
new='''    <nav class="tabs">
      <button class="tab-btn active" id="tab-btn-account" data-tab="account">👤 Account</button>
      <button class="tab-btn" data-tab="files">📁 Files</button>
      <button class="tab-btn" id="tab-btn-workspaces" data-tab="workspaces">🗂️ Workspace Manager</button>
      <button class="tab-btn hidden" id="tab-btn-sorter" data-tab="sorter">🧹 Sorter</button>
      <button class="tab-btn hidden" id="tab-btn-system" data-tab="system">🖥️ System</button>
      <button class="tab-btn hidden" id="tab-btn-admin-future" data-tab="admin-future">🛡️ Admin</button>
    </nav>'''
if old not in s: raise SystemExit('nav block not found')
s=s.replace(old,new,1)
s=s.replace('<section id="tab-files" class="tab-panel active">','<section id="tab-files" class="tab-panel">',1)
s=s.replace('<section id="tab-account" class="tab-panel workspace-panel">','<section id="tab-account" class="tab-panel workspace-panel active">',1)
if 'id="tab-admin-future"' not in s:
    marker='''    <section id="tab-system" class="tab-panel sys-panel">'''
    future='''    <section id="tab-admin-future" class="tab-panel workspace-panel">
      <div class="workspace-page-header"><div><h2>Admin</h2><p class="muted-text">Reserved for future administration controls.</p></div></div>
    </section>

'''
    s=s.replace(marker,future+marker,1)
p.write_text(s,encoding='utf-8')
print('tabs reordered with Account first')