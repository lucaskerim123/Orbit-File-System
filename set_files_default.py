from pathlib import Path
root=Path(r"F:\OrbitFS Project\OrbitFS-Panel")

p=root/'public/index.html'
s=p.read_text(encoding='utf-8-sig')
s=s.replace('<button class="tab-btn active" id="tab-btn-account" data-tab="account">','<button class="tab-btn" id="tab-btn-account" data-tab="account">',1)
s=s.replace('<button class="tab-btn" data-tab="files">','<button class="tab-btn active" data-tab="files">',1)
s=s.replace('<section id="tab-files" class="tab-panel">','<section id="tab-files" class="tab-panel active">',1)
s=s.replace('<section id="tab-account" class="tab-panel workspace-panel active">','<section id="tab-account" class="tab-panel workspace-panel">',1)
p.write_text(s,encoding='utf-8')

p=root/'public/app.js'
s=p.read_text(encoding='utf-8-sig')
s=s.replace('''  switchTab("account");
  loadAccountPanel();''','''  switchTab("files");
  loadFiles();''',1)
p.write_text(s,encoding='utf-8')
print('Files set as default tab')