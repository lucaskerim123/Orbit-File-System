from pathlib import Path
p=Path(r"F:\OrbitFS Project\OrbitFS-Panel\public\workspace-ui.js")
s=p.read_text(encoding='utf-8-sig')
s=s.replace('''    option.textContent = workspace.is_main ? `Main Workspace - ${workspace.name}` : `${workspace.name}${workspace.status === "suspended" ? " - Suspended" : ""}`;
    option.disabled = workspace.status === "suspended" && state.role !== "admin";''','''    const mainOffline = workspace.is_main && workspace.is_visible === false;
    option.textContent = workspace.is_main
      ? `${workspace.name}${mainOffline ? " — Drive offline" : " — Main Workspace"}`
      : `${workspace.name}${workspace.status === "suspended" ? " — Suspended" : ""}`;
    option.disabled = (workspace.status === "suspended" && state.role !== "admin") || (mainOffline && workspace.permission !== "owner");
    if (mainOffline && workspace.permission !== "owner") option.className = "workspace-option-offline";''',1)
s=s.replace('''  const canManage = state.role === "admin" || workspace.permission === "owner";
  const isSuspended = workspace.status === "suspended";
  const canOpen = !isSuspended || state.role === "admin";''','''  const isOwner = workspace.permission === "owner";
  const canManage = workspace.is_main ? isOwner : (state.role === "admin" || isOwner);
  const isSuspended = workspace.status === "suspended";
  const mainOffline = workspace.is_main && workspace.is_visible === false;
  const canOpen = (!isSuspended || state.role === "admin") && (!mainOffline || isOwner);''',1)
s=s.replace('''      <div><strong>${escapeWorkspaceHtml(workspace.name)}</strong><span>${workspace.is_main ? "Main Workspace" : escapeWorkspaceHtml(workspace.status)}</span></div>
      <button type="button" class="workspace-open-btn" ${canOpen ? "" : "disabled"}>${isSuspended && state.role !== "admin" ? "Suspended" : "Open"}</button>''','''      <div><strong>${escapeWorkspaceHtml(workspace.name)}</strong><span>${workspace.is_main ? (mainOffline ? "Drive offline" : "Main Workspace") : escapeWorkspaceHtml(workspace.status)}</span></div>
      <button type="button" class="workspace-open-btn" ${canOpen ? "" : "disabled"}>${mainOffline && !isOwner ? "Drive offline" : (isSuspended && state.role !== "admin" ? "Suspended" : "Open")}</button>''',1)
s=s.replace('''      ${canManage ? '<button type="button" class="workspace-members-btn">Members</button>' : ""}
      ${!workspace.is_main && canManage ? '<button type="button" class="workspace-edit-btn">Settings</button>' : ""}''','''      ${canManage ? '<button type="button" class="workspace-members-btn">Members</button>' : ""}
      ${workspace.is_main && isOwner ? `<button type="button" class="workspace-visibility-btn">${mainOffline ? "Bring drive online" : "Hide drive"}</button>` : ""}
      ${!workspace.is_main && canManage ? '<button type="button" class="workspace-edit-btn">Settings</button>' : ""}''',1)
s=s.replace('''  card.querySelector(".workspace-members-btn")?.addEventListener("click", () => showWorkspaceMembers(workspace, card));''','''  card.querySelector(".workspace-members-btn")?.addEventListener("click", () => showWorkspaceMembers(workspace, card));
  card.querySelector(".workspace-visibility-btn")?.addEventListener("click", async () => {
    try {
      await api(`/api/workspaces/${encodeURIComponent(workspace.id)}/visibility`, {
        method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({visible:mainOffline}),
      });
      await loadOrbitWorkspaces(workspace.id);
    } catch (error) { alert(error.message); }
  });''',1)
p.write_text(s,encoding='utf-8')
print('Main Workspace offline UI applied')