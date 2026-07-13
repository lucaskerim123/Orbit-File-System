from pathlib import Path
html = Path('public/index.html').read_text(encoding='utf-8', errors='replace')
for line in html.splitlines():
    if 'data-tab=' in line or 'section id="tab-files"' in line or 'section id="tab-account"' in line:
        print(repr(line))
app = Path('public/app.js').read_text(encoding='utf-8', errors='replace')
start = app.index('function showApp()')
print(repr(app[start:start+700]))
