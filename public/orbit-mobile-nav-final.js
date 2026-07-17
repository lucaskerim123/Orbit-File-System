(() => {
  if (window.__orbitMobileNavFinalLoaded) return;
  window.__orbitMobileNavFinalLoaded = true;

  const q = (selector) => document.querySelector(selector);
  const qa = (selector) => [...document.querySelectorAll(selector)];

  function activeTabName() {
    return q(".tab-panel.active")?.id?.replace(/^tab-/, "") || "files";
  }

  function enforceMainNav() {
    qa("nav.tabs .tab-btn").forEach((button) => {
      const tab = button.dataset.tab;
      const allowed = ["files", "workspaces", "system"].includes(tab);
      button.classList.toggle("hidden", !allowed);
      if (!allowed) button.classList.add("more-managed-tab");
    });
    const more = q("#more-menu-btn");
    const nav = q("nav.tabs");
    if (nav && more && more.parentElement !== nav) nav.appendChild(more);
  }

  function enforceWorkspaceBar() {
    const bar = q("#workspace-bar");
    if (!bar) return;
    bar.classList.toggle("hidden", activeTabName() !== "workspaces");
  }

  function fixCurrentUserText() {
    const el = q("#current-user");
    if (!el || !el.textContent) return;
    el.textContent = el.textContent
      .replace(/Â\s*[·•]/g, "·")
      .replace(/A�/g, "·")
      .replace(/�/g, "");
  }

  function apply() {
    enforceMainNav();
    enforceWorkspaceBar();
    fixCurrentUserText();
  }

  function install() {
    apply();
    setInterval(apply, 700);
    document.addEventListener("click", () => setTimeout(apply, 0), true);
    const observer = new MutationObserver(() => requestAnimationFrame(apply));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
