(() => {
  if (window.__orbitLayoutTweaksLoaded) return;
  window.__orbitLayoutTweaksLoaded = true;

  function activeTabName() {
    return document.querySelector(".tab-btn.active")?.dataset?.tab || "files";
  }

  function syncWorkspaceBarVisibility() {
    const bar = document.getElementById("workspace-bar");
    if (bar) bar.classList.toggle("hidden", activeTabName() !== "files");
  }

  function groupSystemMonitorAndControls() {
    const system = document.getElementById("tab-system");
    const telemetry = system?.querySelector(".sys-zone-telemetry");
    const controls = system?.querySelector(".sys-zone-controls");
    if (!telemetry || !controls) return;
    const card = [...controls.querySelectorAll("details.card")]
      .find((item) => item.querySelector("summary")?.textContent.trim() === "Server controls");
    if (card && card.parentElement !== telemetry) {
      card.classList.add("system-server-controls-inline");
      telemetry.appendChild(card);
    }
  }

  function removeStartupLoading() {
    [...document.querySelectorAll("details.card,article.card,section.card,.card")].forEach((card) => {
      const title = card.querySelector("summary,h2,h3")?.textContent?.trim().toLowerCase();
      if (title === "startup loading") card.remove();
    });
  }

  function removeWorkspaceStorage() {
    document.getElementById("workspace-system-storage")?.remove();
    const system = document.getElementById("tab-system");
    if (!system) return;
    [...system.querySelectorAll("details.card,.card")].forEach((card) => {
      const title = card.querySelector("summary,h2,h3,strong")?.textContent?.trim().toLowerCase();
      if (title === "workspace storage") card.remove();
    });
    document.getElementById("disk-bar")?.remove();
    const label = document.getElementById("disk-summary")?.closest(".infra-item")?.querySelector("span:first-child");
    if (label) label.textContent = "Total drive storage";
  }

  function applyLayout() {
    syncWorkspaceBarVisibility();
    groupSystemMonitorAndControls();
    removeStartupLoading();
    removeWorkspaceStorage();
  }

  function loadScriptOnce(src, marker) {
    if (document.querySelector(`script[${marker}="1"]`)) return;
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.setAttribute(marker, "1");
    document.body.appendChild(script);
  }

  function install() {
    applyLayout();
    loadScriptOnce("drive-upload.js", "data-orbit-drive-upload");
    loadScriptOnce("page-refresh.js", "data-orbit-page-refresh");
    loadScriptOnce("workspace-extras.js", "data-orbit-workspace-extras");
    loadScriptOnce("tab-restrictions.js", "data-orbit-tab-restrictions");

    document.querySelectorAll(".tab-btn").forEach((button) => {
      if (button.dataset.layoutWired) return;
      button.dataset.layoutWired = "1";
      button.addEventListener("click", () => requestAnimationFrame(applyLayout));
    });

    document.getElementById("system-refresh-btn")?.addEventListener("click", () => setTimeout(applyLayout, 0));

    const style = document.createElement("style");
    style.textContent = `
      #workspace-bar.hidden{display:none!important}
      #workspace-system-storage,#disk-bar{display:none!important}
      .sys-zone-telemetry>.system-server-controls-inline{margin-top:12px}
      .sys-zone-controls:empty{display:none}
      #tab-admin [id="startup-config-form"],#tab-admin [id="startup-picker-shell"],#tab-admin [id="startup-picker"]{display:none!important}
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();