from pathlib import Path
root=Path(r"F:\OrbitFS Project\OrbitFS-Panel")

p=root/'server.js'
s=p.read_text(encoding='utf-8')
anchor='''const __dirname = path.dirname(fileURLToPath(import.meta.url));'''
helper='''const __dirname = path.dirname(fileURLToPath(import.meta.url));

function withTimeout(promise, ms, message = "Operation timed out") {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}'''
if 'function withTimeout(' not in s:
    s=s.replace(anchor,helper,1)
s=s.replace('entries = await hive.listFiles(req.query.subpath);','entries = await withTimeout(hive.listFiles(req.query.subpath), 3500, "MCP file listing timed out");',1)
s=s.replace('content = await hive.readFile(req.query.path);','content = await withTimeout(hive.readFile(req.query.path), 3500, "MCP file read timed out");',1)
p.write_text(s,encoding='utf-8')

p=root/'public/permissions.js'
s=p.read_text(encoding='utf-8',errors='replace')
lines=s.splitlines()
for i,line in enumerate(lines):
    if 'Customize user permissions' in line and 'textContent' in line:
        lines[i]='  const btn = Object.assign(document.createElement("button"), { className: "icon-btn", textContent: "⚙", title: "Customize user permissions" });'
s='\n'.join(lines)+'\n'
p.write_text(s,encoding='utf-8')
print('main loading fallback and permissions script fixed')