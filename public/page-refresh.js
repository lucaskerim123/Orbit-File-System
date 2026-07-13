(() => {
  if (window.__orbitPageRefreshLoaded) return;
  window.__orbitPageRefreshLoaded = true;

  async function refreshAccount() {
    const result = await api("/api/me");
    const user = result.user || {};
    const username = document.getElementById("account-username");
    const email = document.getElementById("account-email");
    const stats = document.getElementById("account-stats");
    if (username) username.value = user.username || state.username || "";
    if (email) email.value = user.email || "";
    if (stats) {
      const workspace = typeof currentWorkspace === "function" ? currentWorkspace() : null;
      stats.innerHTML = `
        <div><span>Account role</span><strong>${user.role || state.role || "—"}</strong></div>
        <div><span>Owned workspaces</span><strong>${Number(user.owned_workspaces || 0)}</strong></div>
        <div><span>Memberships</span><strong>${Number(user.workspace_memberships || 0)}</strong></div>
        <div><span>Active sessions</span><strong>${Number(user.active_sessions || 0)}</strong></div>
        <div><span>Current workspace</span><strong>${workspace?.name || "—"}</strong></div>`;
    }
  }

  const pageRefreshers = {
    files: async () => {
      if (typeof loadFiles === "function") await loadFiles();
    },
    workspaces: async () => {
      if (typeof loadOrbitWorkspaces === "function") await loadOrbitWorkspaces(state.workspaceId);
      if (typeof loadWorkspaceInvitations === "function") await loadWorkspaceInvitations();
      if (typeof loadWorkspaceTransferRequests === "function") await loadWorkspaceTransferRequests();
    },
    account: refreshAccount,
    sorter: async () => {
      if (typeof sorterLoad === "function") await sorterLoad();
    },
    system: async () => {
      if (typeof loadSystem === "function") await loadSystem();
    },
    admin: async () => {
      if (typeof loadUsers === "function") await loadUsers();
      if (typeof loadPermissions === "function") await loadPermissions();
      if (typeof loadOrbitWorkspaces === "function") await loadOrbitWorkspaces(state.workspaceId);
      if (typeof window.refreshTabRestrictionAdmin === "function") await window.refreshTabRestrictionAdmin();
    },
  };

  async function runRefresh(tabName, button) {
    if (button.disabled) return;
    const original = button.innerHTML;
    button.disabled = true;
    button.classList.add("refreshing");
    button.innerHTML = '<span aria-hidden="true">⟳</span> Refreshing…';
    try {
      await pageRefreshers[tabName]?.();
      button.innerHTML = '<span aria-hidden="true">✓</span> Refreshed';
      setTimeout(() => { button.innerHTML = original; }, 850);
    } catch (error) {
      console.error(`Failed to refresh ${tabName}`, error);
      button.innerHTML = '<span aria-hidden="true">!</span> Failed';
      setTimeout(() => { button.innerHTML = original; }, 1200);
    } finally {
      setTimeout(() => {
        button.classList.remove("refreshing");
        button.disabled = false;
      }, 250);
    }
  }

  function makeRefreshButton(tabName) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-refresh-btn";
    button.dataset.refreshTab = tabName;
    button.innerHTML = '<span aria-hidden="true">⟳</span> Refresh';
    button.addEventListener("click", () => runRefresh(tabName, button));
    return button;
  }

  function installFilesRefresh() {
    const toolbar = document.querySelector("#tab-files > .toolbar:first-child");
    if (!toolbar || toolbar.querySelector('[data-refresh-tab="files"]')) return;
    const spacer = document.createElement("span");
    spacer.className = "spacer";
    toolbar.append(spacer, makeRefreshButton("files"));
  }

  function installHeaderRefresh(tabName) {
    const panel = document.getElementById(`tab-${tabName}`);
    const header = panel?.querySelector(".workspace-page-header,.sys-header");
    if (!header || header.querySelector(`[data-refresh-tab="${tabName}"]`)) return;
    header.appendChild(makeRefreshButton(tabName));
  }

  function wireExisting(id, tabName) {
    const button = document.getElementById(id);
    if (!button || button.dataset.pageRefreshWired) return;
    button.dataset.pageRefreshWired = "1";
    button.dataset.refreshTab = tabName;
    button.classList.add("page-refresh-btn");
    button.addEventListener("click", () => runRefresh(tabName, button));
  }

  function install() {
    installFilesRefresh();
    installHeaderRefresh("workspaces");
    installHeaderRefresh("account");
    wireExisting("sorter-refresh-btn", "sorter");
    wireExisting("system-refresh-btn", "system");
    wireExisting("admin-refresh-btn", "admin");

    const style = document.createElement("style");
    style.textContent = `
      .page-refresh-btn{margin-left:auto;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;white-space:nowrap}
      .page-refresh-btn.refreshing span{display:inline-block;animation:orbit-refresh-spin .8s linear infinite}
      #tab-files>.toolbar:first-child{display:flex;align-items:center;gap:10px}
      #tab-files>.toolbar:first-child .breadcrumb{min-width:0;flex:1}
      @keyframes orbit-refresh-spin{to{transform:rotate(360deg)}}
      @media(max-width:600px){
        .workspace-page-header{align-items:flex-start;gap:8px;flex-wrap:wrap}
        .workspace-page-header .page-refresh-btn{min-height:38px;padding:8px 10px}
        #tab-files>.toolbar:first-child .page-refresh-btn{min-height:38px;padding:8px 10px}
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();