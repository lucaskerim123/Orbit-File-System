from pathlib import Path
root=Path(r"F:\OrbitFS Project\OrbitFS-Panel")

p=root/'public/index.html'
s=p.read_text(encoding='utf-8', errors='replace')
replacements={
'dY`\x0f Account':'Account',
'dY"? Files':'Files',
'dY-,�,? Workspace Manager':'Workspace Manager',
'dY\x151 Sorter':'Sorter',
'dY-��,? System':'System',
'dY>��,? Admin':'Admin',
'�Y3 Refresh':'Refresh',
}
for old,new in replacements.items(): s=s.replace(old,new)
p.write_text(s,encoding='utf-8')

p=root/'public/app.js'
s=p.read_text(encoding='utf-8', errors='replace')
s=s.replace('`${state.username} A� ${state.role}`','`${state.username} · ${state.role}`')
s=s.replace('  switchTab("account");\n  loadAccountPanel();','  switchTab("files");\n  loadFiles();',1)
p.write_text(s,encoding='utf-8')
print('encoding labels and Files default fixed')