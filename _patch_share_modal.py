from pathlib import Path
root = Path(r"F:\OrbitFS Project\OrbitFS-Panel")
index = root / "public" / "index.html"
app = root / "public" / "app.js"
css = root / "public" / "style.css"

s = index.read_text(encoding="utf-8")
insert_after = '''  </div>

  <div id="move-picker-overlay"'''
modal = '''  </div>

  <div id="share-modal-overlay" class="modal-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="share-modal-title">
    <div class="modal-box share-modal-box">
      <h2 id="share-modal-title">Share file</h2>
      <p id="share-modal-file" class="muted-text share-modal-file"></p>
      <label class="move-picker-name-label" for="share-days-input">Expires after days</label>
      <input id="share-days-input" type="number" min="1" max="30" value="7" inputmode="numeric" />
      <div id="share-link-wrap" class="share-link-wrap hidden">
        <label class="move-picker-name-label" for="share-link-input">Share link</label>
        <textarea id="share-link-input" readonly rows="3"></textarea>
        <p id="share-link-expiry" class="muted-text"></p>
      </div>
      <p id="share-modal-error" class="error"></p>
      <div class="modal-actions share-modal-actions">
        <button id="share-modal-close" type="button">Close</button>
        <button id="share-modal-open" type="button" class="hidden">Open</button>
        <button id="share-modal-copy" type="button" class="hidden primary">Copy</button>
        <button id="share-modal-create" type="button" class="primary">Create Link</button>
      </div>
    </div>
  </div>

  <div id="move-picker-overlay"'''
if 'id="share-modal-overlay"' not in s:
    if insert_after not in s:
        raise SystemExit('index insertion point not found')
    s = s.replace(insert_after, modal, 1)
index.write_text(s, encoding="utf-8")

s = app.read_text(encoding="utf-8")
old = '''async function shareFile(filepath) {
  try {
    const daysRaw = prompt("Share link expires after how many days?", "7");
    if (daysRaw === null) return;
    const days = Math.max(1, Math.min(30, Number(daysRaw) || 7));
    const resp = await api("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filepath, days }),
    });
    const copied = await copyText(resp.url).catch(() => false);
    alert(copied ? `Share link copied. Expires: ${new Date(resp.expiresAt).toLocaleString()}` : `Share link:\n${resp.url}`);
  } catch (err) {
    alert(err.message);
  }
}
'''
new = '''const shareModal = { filepath: "", url: "" };

function closeShareModal() {
  document.getElementById("share-modal-overlay")?.classList.add("hidden");
  shareModal.filepath = "";
  shareModal.url = "";
}

function resetShareModal(filepath) {
  shareModal.filepath = filepath;
  shareModal.url = "";
  document.getElementById("share-modal-file").textContent = filepath;
  document.getElementById("share-days-input").value = "7";
  document.getElementById("share-link-input").value = "";
  document.getElementById("share-link-expiry").textContent = "";
  document.getElementById("share-modal-error").textContent = "";
  document.getElementById("share-link-wrap").classList.add("hidden");
  document.getElementById("share-modal-copy").classList.add("hidden");
  document.getElementById("share-modal-open").classList.add("hidden");
  document.getElementById("share-modal-create").classList.remove("hidden");
  document.getElementById("share-modal-overlay").classList.remove("hidden");
}

async function createShareFromModal() {
  const error = document.getElementById("share-modal-error");
  const button = document.getElementById("share-modal-create");
  try {
    error.textContent = "";
    const days = Math.max(1, Math.min(30, Number(document.getElementById("share-days-input").value) || 7));
    button.disabled = true;
    const resp = await api("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: shareModal.filepath, days }),
    });
    shareModal.url = resp.url;
    const input = document.getElementById("share-link-input");
    input.value = resp.url;
    document.getElementById("share-link-expiry").textContent = `Expires: ${new Date(resp.expiresAt).toLocaleString()}`;
    document.getElementById("share-link-wrap").classList.remove("hidden");
    document.getElementById("share-modal-copy").classList.remove("hidden");
    document.getElementById("share-modal-open").classList.remove("hidden");
    document.getElementById("share-modal-create").classList.add("hidden");
    setTimeout(() => { input.focus(); input.select(); }, 30);
  } catch (err) {
    error.textContent = err.message;
  } finally {
    button.disabled = false;
  }
}

async function copyShareLinkFromModal() {
  const input = document.getElementById("share-link-input");
  const ok = await copyText(input.value).catch(() => false);
  document.getElementById("share-modal-error").textContent = ok ? "Copied." : "Copy failed. Select the link and copy it manually.";
  input.focus();
  input.select();
}

function shareFile(filepath) {
  resetShareModal(filepath);
}

document.getElementById("share-modal-create")?.addEventListener("click", createShareFromModal);
document.getElementById("share-modal-copy")?.addEventListener("click", copyShareLinkFromModal);
document.getElementById("share-modal-open")?.addEventListener("click", () => shareModal.url && window.open(shareModal.url, "_blank", "noopener"));
document.getElementById("share-modal-close")?.addEventListener("click", closeShareModal);
document.getElementById("share-modal-overlay")?.addEventListener("click", (event) => {
  if (event.target.id === "share-modal-overlay") closeShareModal();
});
'''
if old not in s:
    raise SystemExit('old shareFile block not found')
s = s.replace(old, new, 1)
app.write_text(s, encoding="utf-8")

s = css.read_text(encoding="utf-8")
add = '''
.share-modal-box { max-width: 560px; }
.share-modal-file { overflow-wrap: anywhere; margin-top: -0.25rem; }
.share-link-wrap textarea {
  width: 100%;
  min-height: 5.4rem;
  resize: vertical;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg);
  color: var(--text);
  padding: 0.75rem;
  font: 0.9rem/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.share-modal-actions { gap: 0.45rem; }
.share-modal-actions button { min-width: 76px; }
'''
if '.share-modal-box' not in s:
    s += add
css.write_text(s, encoding="utf-8")
print('patched share modal')
