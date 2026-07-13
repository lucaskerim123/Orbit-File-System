(() => {
  if (window.__orbitWorkspaceUiLoaded) return;
  window.__orbitWorkspaceUiLoaded = true;

  state.workspaceId = localStorage.getItem("panelWorkspaceId") || "";
  state.workspaces = [];
  state.workspaceSettings = { maxWorkspacesPerUser: 1, ownedCount: 0 };

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (url.startsWith("/api/") && state.workspaceId) {
      const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined) || {});
      headers.set("X-Workspace-Id", state.workspaceId);
      init = { ...init, headers };
    }
    return nativeFetch(input, init);
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__orbitApiRequest = typeof url === "string" && url.startsWith("/api/");
    return xhrOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(body) {
    if (this.__orbitApiRequest && state.workspaceId) this.setRequestHeader("X-Workspace-Id", state.workspaceId);
    return xhrSend.call(this, body);
  };

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "workspace-ui.css";
  document.head.appendChild(css);
})();
function workspaceFormatBytes(value) {
  const n = Number(value || 0);
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = n;
  let i = -1;
  do { size /= 1024; i += 1; } while (size >= 1024 && i < units.length - 1);
  return `${size.toFixed(size >= 10 ? 1 : 2)} ${units[i]}`;
}

function currentWorkspace() {
  return state.workspaces.find((item) => String(item.id) === String(state.workspaceId))
    || state.workspaces.find((item) => item.is_main)
    || state.workspaces[0]
    || null;
}

function ensureWorkspaceBar() {
  if (document.getElementById("workspace-bar")) return;
  const user = document.getElementById("current-user");
  if (!user) return;
  const bar = document.createElement("section");
  bar.id = "workspace-bar";
  bar.className = "workspace-bar";
  bar.innerHTML = `
    <div class="workspace-picker"><label for="workspace-select">Workspace</label><select id="workspace-select"></select></div>
    <div class="workspace-status"><strong id="workspace-role"></strong><span id="workspace-storage"></span></div>
    <button id="workspace-create-btn" type="button" class="primary">+ Workspace</button>
    <div class="workspace-meter"><span id="workspace-meter-fill"></span></div>`;
  user.insertAdjacentElement("afterend", bar);
  document.getElementById("workspace-select").addEventListener("change", switchWorkspace);
  document.getElementById("workspace-create-btn").addEventListener("click", openWorkspaceDialog);
}

function renderWorkspaceBar() {
  ensureWorkspaceBar();
  const select = document.getElementById("workspace-select");
  if (!select) return;
  select.innerHTML = "";
  for (const workspace of state.workspaces) {
    const option = document.createElement("option");
    option.value = workspace.id;
    option.textContent = workspace.is_main ? `Main Workspace — ${workspace.name}` : `${workspace.name}${workspace.status === "suspended" ? " — Suspended" : ""}`;
    option.disabled = workspace.status === "suspended" && state.role !== "admin";
    select.appendChild(option);
  }
  select.value = state.workspaceId;
  const createButton = document.getElementById("workspace-create-btn");
  const max = Number(state.workspaceSettings?.maxWorkspacesPerUser ?? 1);
  const owned = Number(state.workspaceSettings?.ownedCount ?? 0);
  const reached = max > 0 && owned >= max;
  if (createButton) { createButton.disabled = reached; createButton.title = reached ? `Workspace limit reached (${max})` : `${owned} of ${max || "unlimited"} workspaces used`; }
  const workspace = currentWorkspace();
  if (!workspace) return;
  document.getElementById("workspace-role").textContent = workspace.is_main ? "Main" : (workspace.permission || "viewer");
  const storage = document.getElementById("workspace-storage");
  const fill = document.getElementById("workspace-meter-fill");
  if (workspace.storage_quota_mode === "unlimited" || workspace.storage_quota_bytes == null) {
    storage.textContent = "Unlimited storage";
    fill.style.width = "0%";
  } else {
    const used = Number(workspace.storage_used_bytes || 0);
    const quota = Number(workspace.storage_quota_bytes || 0);
    storage.textContent = `${workspaceFormatBytes(used)} of ${workspaceFormatBytes(quota)}`;
    fill.style.width = `${quota ? Math.min(100, used / quota * 100) : 0}%`;
  }
}

async function loadOrbitWorkspaces(preferredId = state.workspaceId) {
  if (!state.token) return;
  ensureWorkspaceBar();
  try {
    const response = await api("/api/workspaces");
    state.workspaces = response.workspaces || [];
    state.workspaceSettings = { maxWorkspacesPerUser: Number(response.settings?.maxWorkspacesPerUser ?? 1), ownedCount: Number(response.ownedCount ?? 0) };
    const selected = state.workspaces.find((item) => String(item.id) === String(preferredId))
      || state.workspaces.find((item) => item.is_main)
      || state.workspaces[0];
    state.workspaceId = selected ? String(selected.id) : "";
    if (state.workspaceId) localStorage.setItem("panelWorkspaceId", state.workspaceId);
    renderWorkspaceBar();
    renderWorkspaceAdmin();
    loadWorkspaceInvitations();
  } catch (error) {
    const storage = document.getElementById("workspace-storage");
    if (storage) storage.textContent = error.message;
  }
}
window.loadOrbitWorkspaces = loadOrbitWorkspaces;


let workspaceFileLoadGeneration = 0;

function resetWorkspaceView() {
  workspaceFileLoadGeneration += 1;
  state.subpath = "";
  if (typeof closeAllPanels === "function") closeAllPanels();
  const list = document.getElementById("file-list");
  if (list) list.innerHTML = "<li>Loading workspace…</li>";
  const breadcrumb = document.getElementById("breadcrumb");
  if (breadcrumb) breadcrumb.textContent = "/";
  const uploadPanel = document.getElementById("upload-panel");
  if (uploadPanel) uploadPanel.classList.add("hidden");
}

async function activateWorkspace(workspaceId, { openFiles = true } = {}) {
  if (typeof confirmDiscardIfDirty === "function" && !confirmDiscardIfDirty()) return false;
  state.workspaceId = String(workspaceId || "");
  if (state.workspaceId) localStorage.setItem("panelWorkspaceId", state.workspaceId);
  else localStorage.removeItem("panelWorkspaceId");
  resetWorkspaceView();
  renderWorkspaceBar();
  if (openFiles) switchTab("files");
  await loadFiles();
  return true;
}

loadFiles = async function workspaceAwareLoadFiles() {
  const generation = ++workspaceFileLoadGeneration;
  const workspaceId = String(state.workspaceId || "");
  const subpath = String(state.subpath || "");
  const list = document.getElementById("file-list");
  document.getElementById("breadcrumb").textContent = `/${subpath}`;
  list.innerHTML = "<li>Loading…</li>";
  try {
    const { entries, folderPermissions } = await api(`/api/files?subpath=${encodeURIComponent(subpath)}`);
    if (generation !== workspaceFileLoadGeneration || workspaceId !== String(state.workspaceId || "") || subpath !== String(state.subpath || "")) return;
    state.folderPermissions = effectivePermissions(folderPermissions);
    document.getElementById("new-folder-btn").classList.toggle("hidden", !state.folderPermissions.create);
    document.getElementById("upload-btn").classList.toggle("hidden", !state.folderPermissions.create);
    list.innerHTML = "";
    if (subpath) {
      const up = document.createElement("li");
      up.className = "dir";
      up.innerHTML = `<span class="row-name">..</span>`;
      up.querySelector(".row-name").addEventListener("click", () => {
        state.subpath = state.subpath.split("/").slice(0, -1).join("/");
        loadFiles();
      });
      list.appendChild(up);
    }
    entries.sort((a,b)=>(a.type===b.type?a.name.localeCompare(b.name):a.type==="dir"?-1:1)).forEach((entry)=>renderRow(list,entry));
    if (!entries.length && !subpath) list.innerHTML = "<li>(empty)</li>";
  } catch (err) {
    if (generation === workspaceFileLoadGeneration && workspaceId === String(state.workspaceId || "")) list.innerHTML = `<li>${escapeWorkspaceHtml(err.message)}</li>`;
  }
};

async function switchWorkspace(event) {
  const previous = state.workspaceId;
  const changed = await activateWorkspace(event.target.value);
  if (!changed) event.target.value = previous;
}

function ensureWorkspaceDialog() {
  if (document.getElementById("workspace-dialog")) return;
  const overlay = document.createElement("div");
  overlay.id = "workspace-dialog";
  overlay.className = "modal-overlay hidden";
  overlay.innerHTML = `
    <form id="workspace-form" class="modal-box workspace-dialog-box">
      <h2>Create workspace</h2>
      <label class="field-label" for="workspace-name">Name</label>
      <input id="workspace-name" type="text" maxlength="80" required autocomplete="off" />
      <label class="field-label" for="workspace-description">Description</label>
      <textarea id="workspace-description" rows="4" maxlength="500"></textarea>
      <p id="workspace-limit-hint" class="field-hint">2.5 GB default quota. Storage can later be moved to another drive.</p>
      <p id="workspace-form-error" class="error"></p>
      <div class="modal-actions"><button id="workspace-cancel" type="button">Cancel</button><button type="submit" class="primary">Create</button></div>
    </form>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeWorkspaceDialog(); });
  document.getElementById("workspace-cancel").addEventListener("click", closeWorkspaceDialog);
  document.getElementById("workspace-form").addEventListener("submit", createWorkspaceFromDialog);
}

function openWorkspaceDialog() {
  ensureWorkspaceDialog();
  const max = Number(state.workspaceSettings?.maxWorkspacesPerUser ?? 1);
  const owned = Number(state.workspaceSettings?.ownedCount ?? 0);
  if (max > 0 && owned >= max) return alert(`Workspace limit reached (${max})`);
  const hint = document.getElementById("workspace-limit-hint");
  if (hint) hint.textContent = `2.5 GB default quota · ${owned} of ${max || "unlimited"} workspaces used.`;
  document.getElementById("workspace-dialog").classList.remove("hidden");
  document.getElementById("workspace-name").focus();
}

function closeWorkspaceDialog() {
  const dialog = document.getElementById("workspace-dialog");
  if (!dialog) return;
  dialog.classList.add("hidden");
  document.getElementById("workspace-form").reset();
  document.getElementById("workspace-form-error").textContent = "";
}

async function createWorkspaceFromDialog(event) {
  event.preventDefault();
  const error = document.getElementById("workspace-form-error");
  const submit = event.target.querySelector('button[type="submit"]');
  error.textContent = "";
  submit.disabled = true;
  try {
    const result = await api("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("workspace-name").value.trim(),
        description: document.getElementById("workspace-description").value.trim(),
      }),
    });
    closeWorkspaceDialog();
    await loadOrbitWorkspaces(result.workspace.id);
    state.subpath = "";
    if (typeof closeAllPanels === "function") closeAllPanels();
    loadFiles();
  } catch (err) {
    error.textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}

function ensureWorkspaceAdmin() {
  if (document.getElementById("workspace-admin-list")) return;
  const host = document.getElementById("workspace-manager-host");
  if (!host) return;
  const card = document.createElement("details");
  card.className = "card workspace-manager-card";
  card.open = true;
  card.innerHTML = `
    <summary>Workspace manager</summary>
    <p id="workspace-admin-summary" class="muted-text"></p>
    ${state.role === "admin" ? `<form id="workspace-limit-form" class="workspace-limit-form">
      <label for="workspace-max-per-user">Maximum workspaces per user</label>
      <input id="workspace-max-per-user" type="number" min="0" max="1000" step="1" required />
      <button type="submit" class="primary">Save limit</button>
      <small>0 = unlimited. Main Workspace is not counted.</small>
      <p id="workspace-limit-message" class="error"></p>
    </form>` : ""}
    <div id="workspace-admin-list" class="workspace-admin-list"></div>`;
  host.appendChild(card);
  document.getElementById("workspace-limit-form")?.addEventListener("submit", saveWorkspaceLimit);
}

async function saveWorkspaceLimit(event) {
  event.preventDefault();
  const input = document.getElementById("workspace-max-per-user");
  const message = document.getElementById("workspace-limit-message");
  const button = event.currentTarget.querySelector('button[type="submit"]');
  message.textContent = ""; button.disabled = true;
  try {
    const result = await api("/api/workspace-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxWorkspacesPerUser: Number(input.value) }) });
    state.workspaceSettings.maxWorkspacesPerUser = result.maxWorkspacesPerUser;
    message.className = "muted-text"; message.textContent = "Saved.";
    renderWorkspaceBar(); renderWorkspaceAdmin();
  } catch (error) { message.className = "error"; message.textContent = error.message; }
  finally { button.disabled = false; }
}

function workspaceQuotaText(workspace) {
  if (workspace.storage_quota_mode === "unlimited" || workspace.storage_quota_bytes == null) return "Unlimited";
  return `${workspaceFormatBytes(workspace.storage_used_bytes)} / ${workspaceFormatBytes(workspace.storage_quota_bytes)}`;
}

function renderWorkspaceAdmin() {
  ensureWorkspaceAdmin();
  const list = document.getElementById("workspace-admin-list");
  const summary = document.getElementById("workspace-admin-summary");
  if (!list || !summary) return;
  const total = state.workspaces.reduce((sum, item) => sum + Number(item.storage_used_bytes || 0), 0);
  const max = Number(state.workspaceSettings?.maxWorkspacesPerUser ?? 1);
  summary.textContent = `${state.workspaces.length} visible workspace${state.workspaces.length === 1 ? "" : "s"} · ${workspaceFormatBytes(total)} tracked · user limit ${max || "unlimited"}`;
  const input = document.getElementById("workspace-max-per-user");
  if (input) input.value = String(max);
  list.innerHTML = "";
  for (const workspace of state.workspaces) list.appendChild(buildWorkspaceAdminCard(workspace));
}

function buildWorkspaceAdminCard(workspace) {
  const canManage = state.role === "admin" || workspace.permission === "owner";
  const isSuspended = workspace.status === "suspended";
  const canOpen = !isSuspended || state.role === "admin";
  const card = document.createElement("article");
  card.className = `workspace-admin-card${isSuspended ? " workspace-suspended" : ""}`;
  card.innerHTML = `
    <div class="workspace-admin-head">
      <div><strong>${escapeWorkspaceHtml(workspace.name)}</strong><span>${workspace.is_main ? "Main Workspace" : escapeWorkspaceHtml(workspace.status)}</span></div>
      <button type="button" class="workspace-open-btn" ${canOpen ? "" : "disabled"}>${isSuspended && state.role !== "admin" ? "Suspended" : "Open"}</button>
    </div>
    <dl>
      <div><dt>Owner</dt><dd>${escapeWorkspaceHtml(workspace.owner_username || "—")}</dd></div>
      <div><dt>Role</dt><dd>${escapeWorkspaceHtml(workspace.permission || "admin")}</dd></div>
      <div><dt>Storage</dt><dd>${escapeWorkspaceHtml(workspaceQuotaText(workspace))}</dd></div>
      <div><dt>Root</dt><dd>${escapeWorkspaceHtml(workspace.filesystem_root || "—")}</dd></div>
    </dl>
    ${isSuspended ? `<p class="workspace-suspension-note"><strong>Suspended</strong>${workspace.suspension_reason ? ` — ${escapeWorkspaceHtml(workspace.suspension_reason)}` : ""}</p>` : ""}
    <div class="workspace-admin-actions">
      ${canManage ? '<button type="button" class="workspace-members-btn">Members</button>' : ""}
      ${!workspace.is_main && canManage ? '<button type="button" class="workspace-edit-btn">Settings</button>' : ""}
    </div>
    <div class="workspace-admin-detail hidden"></div>`;
  card.querySelector(".workspace-open-btn").addEventListener("click", () => {
    activateWorkspace(workspace.id);
  });
  card.querySelector(".workspace-members-btn")?.addEventListener("click", () => showWorkspaceMembers(workspace, card));
  card.querySelector(".workspace-edit-btn")?.addEventListener("click", () => showWorkspaceSettings(workspace, card));
  return card;
}

function escapeWorkspaceHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;",
  })[char]);
}

async function showWorkspaceMembers(workspace, card) {
  const detail = card.querySelector(".workspace-admin-detail");
  detail.classList.remove("hidden");
  detail.innerHTML = "Loading members…";
  try {
    const { members } = await api(`/api/workspaces/${encodeURIComponent(workspace.id)}/members`);
    const canManage = state.role === "admin" || workspace.permission === "owner";
    detail.innerHTML = `
      <div class="workspace-member-list"></div>
      ${canManage ? `<form class="workspace-member-form">
        <input name="username" type="text" placeholder="Username" required autocomplete="off" />
        <select name="permission"><option value="viewer">Viewer</option><option value="contributor">Contributor</option><option value="editor">Editor</option></select>
        <button type="submit" class="primary">Send invite</button>
      </form>` : ""}
      <p class="error workspace-detail-error"></p>`;
    renderWorkspaceMembers(detail.querySelector(".workspace-member-list"), members, workspace, card, canManage);
    detail.querySelector(".workspace-member-form")?.addEventListener("submit", (event) => inviteWorkspaceMember(event, workspace, card));
  } catch (error) {
    detail.textContent = error.message;
  }
}

function renderWorkspaceMembers(container, members, workspace, card, canManage) {
  container.innerHTML = "";
  for (const member of members) {
    const row = document.createElement("div");
    row.className = "workspace-member-row";
    row.innerHTML = `<span><strong>${escapeWorkspaceHtml(member.username)}</strong><small>${escapeWorkspaceHtml(member.permission)}</small></span>${!canManage || member.permission === "owner" ? "" : '<button type="button" class="danger">Remove</button>'}`;
    row.querySelector("button")?.addEventListener("click", async () => {
      try {
        await api(`/api/workspaces/${encodeURIComponent(workspace.id)}/members/${encodeURIComponent(member.user_id)}`, { method: "DELETE" });
        await showWorkspaceMembers(workspace, card);
        await loadOrbitWorkspaces(workspace.id);
      } catch (error) { alert(error.message); }
    });
    container.appendChild(row);
  }
}


async function inviteWorkspaceMember(event, workspace, card) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = form.parentElement.querySelector(".workspace-detail-error");
  error.textContent = "";
  try {
    await api(`/api/workspaces/${encodeURIComponent(workspace.id)}/invitations`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.elements.username.value.trim(), permission: form.elements.permission.value }),
    });
    form.reset();
    error.className = "muted-text workspace-detail-error";
    error.textContent = "Invitation sent.";
  } catch (err) { error.className = "error workspace-detail-error"; error.textContent = err.message; }
}

async function loadWorkspaceInvitations() {
  const list = document.getElementById("workspace-invitations-list");
  if (!list || !state.token) return;
  try {
    const { invitations } = await api("/api/workspace-invitations");
    list.innerHTML = "";
    if (!invitations.length) { list.innerHTML = '<p class="muted-text">No pending invitations.</p>'; return; }
    for (const invite of invitations) {
      const row = document.createElement("div");
      row.className = "workspace-invite-row";
      row.innerHTML = `<span><strong>${escapeWorkspaceHtml(invite.workspace_name)}</strong><small>${escapeWorkspaceHtml(invite.permission)} · from ${escapeWorkspaceHtml(invite.owner_username || invite.invited_by_username || "owner")}</small></span><div><button data-decision="accept" class="primary">Accept</button><button data-decision="decline">Decline</button></div>`;
      row.querySelectorAll("button").forEach((button) => button.addEventListener("click", async () => {
        await api(`/api/workspace-invitations/${encodeURIComponent(invite.id)}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: button.dataset.decision }) });
        await loadOrbitWorkspaces();
        await loadWorkspaceInvitations();
      }));
      list.appendChild(row);
    }
  } catch (error) { list.innerHTML = `<p class="error">${escapeWorkspaceHtml(error.message)}</p>`; }
}

async function saveWorkspaceMember(event, workspace, card) {
  event.preventDefault();
  const form = event.currentTarget;
  const username = form.elements.username.value.trim();
  const permission = form.elements.permission.value;
  const error = form.parentElement.querySelector(".workspace-detail-error");
  error.textContent = "";
  try {
    await api(`/api/workspaces/${encodeURIComponent(workspace.id)}/members/${encodeURIComponent(username)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permission }),
    });
    form.reset();
    await showWorkspaceMembers(workspace, card);
    await loadOrbitWorkspaces(workspace.id);
  } catch (err) { error.textContent = err.message; }
}

function showWorkspaceSettings(workspace, card) {
  const detail = card.querySelector(".workspace-admin-detail");
  const isAdmin = state.role === "admin";
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <form class="workspace-settings-form">
      <label>Name<input name="name" type="text" value="${escapeWorkspaceHtml(workspace.name)}" required /></label>
      <label>Description<textarea name="description" rows="3">${escapeWorkspaceHtml(workspace.description || "")}</textarea></label>
      ${isAdmin ? `<label>Quota bytes<input name="quota" type="number" min="0" step="1048576" value="${Number(workspace.storage_quota_bytes || 0)}" /></label>
      <label>Filesystem root<input name="root" type="text" value="${escapeWorkspaceHtml(workspace.filesystem_root || "")}" /></label>
      <label>Status<select name="status"><option value="active">Active</option><option value="suspended">Suspended</option><option value="archived">Archived</option></select></label>
      <label>Suspension reason<textarea name="suspensionReason" rows="3" maxlength="500">${escapeWorkspaceHtml(workspace.suspension_reason || "")}</textarea></label>` : ""}
      <button type="submit" class="primary">Save</button>
      <button type="button" class="danger workspace-delete-btn">Delete workspace</button>
    </form>
    <p class="error workspace-detail-error"></p>`;
  if (isAdmin) detail.querySelector('[name="status"]').value = workspace.status;
  detail.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const error = detail.querySelector(".workspace-detail-error");
    const body = { name: form.elements.name.value.trim(), description: form.elements.description.value.trim() };
    if (isAdmin) {
      body.storageQuotaBytes = Number(form.elements.quota.value || 0);
      body.filesystemRoot = form.elements.root.value.trim();
      body.status = form.elements.status.value;
      body.suspensionReason = form.elements.suspensionReason.value.trim();
    }
    try {
      await api(`/api/workspaces/${encodeURIComponent(workspace.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await loadOrbitWorkspaces(workspace.id);
    } catch (err) { error.textContent = err.message; }
  });
  detail.querySelector(".workspace-delete-btn").addEventListener("click", async () => {
    if (!confirm(`Delete workspace "${workspace.name}" and all files permanently?`)) return;
    try {
      await api(`/api/workspaces/${encodeURIComponent(workspace.id)}`, { method: "DELETE" });
      state.workspaceId = "";
      localStorage.removeItem("panelWorkspaceId");
      await loadOrbitWorkspaces();
    } catch (err) { detail.querySelector(".workspace-detail-error").textContent = err.message; }
  });
}

const originalShowApp = showApp;
showApp = function() {
  originalShowApp();
  setTimeout(() => loadOrbitWorkspaces(), 0);
};

const originalLoadSystem = loadSystem;
loadSystem = async function() {
  await originalLoadSystem();
  await loadOrbitWorkspaces(state.workspaceId);
};

ensureWorkspaceDialog();
document.getElementById("workspace-page-create")?.addEventListener("click", openWorkspaceDialog);
if (state.token) setTimeout(() => loadOrbitWorkspaces(), 0);
