from pathlib import Path
p=Path('server.js')
s=p.read_text(encoding='utf-8')
old="""import * as pdfjsLib from '/viewer-assets/pdfjs/pdf.mjs';
import { renderAsync } from '/viewer-assets/docx/docx-preview.mjs';
import { marked } from '/viewer-assets/marked/lib/marked.esm.js';
import DOMPurify from '/viewer-assets/dompurify/purify.es.mjs';
import hljs from '/viewer-assets/highlight/es/common.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/viewer-assets/pdfjs/pdf.worker.mjs';
const viewer = document.getElementById('viewer');
const status = document.getElementById('viewerStatus');
const mode = viewer.dataset.mode;
const ext = viewer.dataset.ext;
const rawUrl = viewer.dataset.raw;
document.getElementById('copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied'; } catch { status.textContent = 'Copy failed'; } });
function setStatus(text){ status.textContent = text; }
function media(tag){ viewer.innerHTML = '<div class=\"media-wrap\"></div>'; const wrap = viewer.firstChild; const el = document.createElement(tag); el.src = rawUrl; if(tag !== 'img'){ el.controls = true; el.playsInline = true; el.preload = 'metadata'; } if(tag === 'img') el.alt = ${JSON.stringify(filename)}; wrap.appendChild(el); setStatus('Ready'); }
async function renderPdf(){ viewer.innerHTML = '<div class=\"pdf-pages\"></div>'; const pages = viewer.firstChild; const pdf = await pdfjsLib.getDocument(rawUrl).promise; setStatus(pdf.numPages + ' page' + (pdf.numPages === 1 ? '' : 's')); const maxWidth = Math.min(980, Math.max(320, viewer.clientWidth - 30)); for(let n=1;n<=pdf.numPages;n++){ const page = await pdf.getPage(n); const baseViewport = page.getViewport({ scale: 1 }); const scale = Math.min(2, maxWidth / baseViewport.width); const viewport = page.getViewport({ scale }); const canvas = document.createElement('canvas'); canvas.className = 'pdf-page'; canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height); canvas.style.width = Math.floor(viewport.width) + 'px'; canvas.style.height = Math.floor(viewport.height) + 'px'; pages.appendChild(canvas); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; } }
async function renderDocx(){ viewer.innerHTML = '<div class=\"doc-view\"></div>'; const target = viewer.firstChild; const buf = await (await fetch(rawUrl)).arrayBuffer(); await renderAsync(buf, target, null, { className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true }); setStatus('DOCX rendered'); }
async function renderText(){ const text = await (await fetch(rawUrl)).text(); viewer.innerHTML = '<div class=\"text-view\"></div>'; const box = viewer.firstChild; if(ext === '.md' || ext === '.markdown'){ box.className = 'text-view markdown-body'; box.innerHTML = DOMPurify.sanitize(marked.parse(text)); box.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block)); setStatus('Markdown rendered'); } else { const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = text; pre.appendChild(code); box.appendChild(pre); if(['.js','.mjs','.ts','.tsx','.jsx','.css','.html','.xml','.json','.yml','.yaml'].includes(ext)) { hljs.highlightElement(code); setStatus('Code rendered'); } else setStatus('Text rendered'); } }
async function main(){ try { if(mode === 'image') media('img'); else if(mode === 'video') media('video'); else if(mode === 'audio') media('audio'); else if(mode === 'pdf') await renderPdf(); else if(mode === 'extracted') await renderDocx(); else if(mode === 'text') await renderText(); else { viewer.innerHTML = '<div class=\"empty\"><div><strong>Preview unavailable</strong><br>Download this file to open it.</div></div>'; setStatus('Download required'); } } catch(err){ console.error(err); viewer.innerHTML = '<div class=\"empty\"><div><strong>Viewer failed</strong><br>' + DOMPurify.sanitize(err.message || 'Could not load this file') + '</div></div>'; setStatus('Viewer failed'); } }
main();
"""
new="""const viewer = document.getElementById('viewer');
const status = document.getElementById('viewerStatus');
const mode = viewer.dataset.mode;
const ext = viewer.dataset.ext;
const rawUrl = viewer.dataset.raw;
document.getElementById('copyBtn').addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); status.textContent = 'Link copied'; } catch { status.textContent = 'Copy failed'; } });
function setStatus(text){ status.textContent = text; }
function escapeText(value){ return String(value || '').replace(/[&<>]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[ch])); }
async function safeImport(url){ try { return await import(url); } catch(err) { throw new Error('Viewer asset failed: ' + url + ' - ' + (err.message || err)); } }
function media(tag){ viewer.innerHTML = '<div class=\"media-wrap\"></div>'; const wrap = viewer.firstChild; const el = document.createElement(tag); el.src = rawUrl; if(tag !== 'img'){ el.controls = true; el.playsInline = true; el.preload = 'metadata'; } if(tag === 'img') el.alt = ${JSON.stringify(filename)}; wrap.appendChild(el); setStatus('Ready'); }
async function renderPdf(){ const pdfjsLib = await safeImport('/viewer-assets/pdfjs/pdf.mjs'); pdfjsLib.GlobalWorkerOptions.workerSrc = '/viewer-assets/pdfjs/pdf.worker.mjs'; viewer.innerHTML = '<div class=\"pdf-pages\"></div>'; const pages = viewer.firstChild; const pdf = await pdfjsLib.getDocument(rawUrl).promise; setStatus(pdf.numPages + ' page' + (pdf.numPages === 1 ? '' : 's')); const maxWidth = Math.min(980, Math.max(320, viewer.clientWidth - 30)); for(let n=1;n<=pdf.numPages;n++){ const page = await pdf.getPage(n); const baseViewport = page.getViewport({ scale: 1 }); const scale = Math.min(2, maxWidth / baseViewport.width); const viewport = page.getViewport({ scale }); const canvas = document.createElement('canvas'); canvas.className = 'pdf-page'; canvas.width = Math.floor(viewport.width); canvas.height = Math.floor(viewport.height); canvas.style.width = Math.floor(viewport.width) + 'px'; canvas.style.height = Math.floor(viewport.height) + 'px'; pages.appendChild(canvas); await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise; } }
async function renderDocx(){ const { renderAsync } = await safeImport('/viewer-assets/docx/docx-preview.mjs'); viewer.innerHTML = '<div class=\"doc-view\"></div>'; const target = viewer.firstChild; const buf = await (await fetch(rawUrl)).arrayBuffer(); await renderAsync(buf, target, null, { className: 'docx', inWrapper: true, ignoreWidth: false, ignoreHeight: false, breakPages: true }); setStatus('DOCX rendered'); }
async function renderText(){ const text = await (await fetch(rawUrl)).text(); viewer.innerHTML = '<div class=\"text-view\"></div>'; const box = viewer.firstChild; if(ext === '.md' || ext === '.markdown'){ const [{ marked }, DOMPurify] = await Promise.all([safeImport('/viewer-assets/marked/lib/marked.esm.js'), safeImport('/viewer-assets/dompurify/purify.es.mjs')]); box.className = 'text-view markdown-body'; box.innerHTML = DOMPurify.default.sanitize(marked.parse(text)); try { const hljs = await safeImport('/viewer-assets/highlight/es/common.js'); box.querySelectorAll('pre code').forEach(block => hljs.default.highlightElement(block)); } catch {} setStatus('Markdown rendered'); } else { const pre = document.createElement('pre'); const code = document.createElement('code'); code.textContent = text; pre.appendChild(code); box.appendChild(pre); if(['.js','.mjs','.ts','.tsx','.jsx','.css','.html','.xml','.json','.yml','.yaml'].includes(ext)) { try { const hljs = await safeImport('/viewer-assets/highlight/es/common.js'); hljs.default.highlightElement(code); setStatus('Code rendered'); } catch { setStatus('Text rendered'); } } else setStatus('Text rendered'); } }
async function main(){ try { if(mode === 'image') media('img'); else if(mode === 'video') media('video'); else if(mode === 'audio') media('audio'); else if(mode === 'pdf') await renderPdf(); else if(mode === 'extracted') await renderDocx(); else if(mode === 'text') await renderText(); else { viewer.innerHTML = '<div class=\"empty\"><div><strong>Preview unavailable</strong><br>Download this file to open it.</div></div>'; setStatus('Download required'); } } catch(err){ console.error(err); viewer.innerHTML = '<div class=\"empty\"><div><strong>Viewer failed</strong><br>' + escapeText(err.message || 'Could not load this file') + '</div></div>'; setStatus('Viewer failed'); } }
main();
"""
if old not in s:
    raise SystemExit('old inline script block not found')
s=s.replace(old,new)
p.write_text(s,encoding='utf-8')
print('patched lazy viewer imports')
