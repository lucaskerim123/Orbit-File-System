(() => {
  if (window.__orbitStartupConfigCleanupLoaded) return;
  window.__orbitStartupConfigCleanupLoaded = true;

  const q = (selector, root = document) => root.querySelector(selector);
  const qa = (selector, root = document) => [...root.querySelectorAll(selector)];
  const ALWAYS_LOAD = [
    "0. Core/Master Logs/Master_Incident_Log_v1",
    "0. Core/Master Logs/Master_Incident_Log_v2",
    "0. Core/Master Logs/Mental_Health_Profiles_Core",
    "0. Core/Master Logs/Master_Relationship_Timeline",
    "0. Core/Master Profiles/Luke_Kerim_Master_Profile.docx",
    "0. Core/Master Profiles/Laura_Woods_Master_Profile.docx",
  ];
  const alwaysLoadKeys = new Set(ALWAYS_LOAD.map((value) => value.replace(/\\/g, "/").toLowerCase()));

  function cardTitle(card) {
    return q("summary,h2,h3,strong", card)?.textContent?.trim().toLowerCase() || "";
  }

  function orderTabs() {
    const nav = q("nav.tabs");
    const systems = q('.tab-btn[data-tab="system"]');
    const config = q('.tab-btn[data-tab="config"]');
    const admin = q('.tab-btn[data-tab="admin"]');
    if (!nav || !systems || !config) return;
    systems.insertAdjacentElement("afterend", config);
    if (admin && config.nextElementSibling !== admin) config.insertAdjacentElement("afterend", admin);
  }

  function renamePresetLabels() {
    qa("#startup-config-form .field-label").forEach((label) => {
      const text = label.textContent.trim().toLowerCase();
      if (text === "low") label.textContent = "Low preset additions";
      if (text === "medium") label.textContent = "Medium preset additions";
      if (text === "high") label.textContent = "High preset additions";
    });
    const save = q('#startup-config-form button[type="submit"]');
    if (save) save.textContent = "Save startup presets";
  }

  function normalizePresetTextarea(textarea) {
    if (!textarea) return;
    const filtered = textarea.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !alwaysLoadKeys.has(line.replace(/\\/g, "/").toLowerCase()));
    textarea.value = [...new Set(filtered)].join("\n");
  }

  function cleanPresetTextareas() {
    ["startup-files-low", "startup-files-medium", "startup-files-high"].forEach((id) => normalizePresetTextarea(q(`#${id}`)));
  }

  function ensureAlwaysLoadedPanel(keep) {
    if (!keep || q("#startup-always-loaded", keep)) return;
    const panel = document.createElement("details");
    panel.id = "startup-always-loaded";
    panel.className = "startup-always-loaded";
    panel.open = false;
    panel.innerHTML = `
      <summary>Always loaded (${ALWAYS_LOAD.length})</summary>
      <p class="muted-text">Loaded fully for every project and strength. They do not need to be added to Low, Medium or High. After startup they can still be unloaded or reloaded from active context.</p>
      <ul>${ALWAYS_LOAD.map((filepath) => `<li><code>${filepath}</code></li>`).join("")}</ul>`;
    q("#startup-config-form", keep)?.insertAdjacentElement("beforebegin", panel);
  }

  function cleanStartupConfig() {
    const host = q("#config-zone-main");
    if (!host) return;

    const startupCards = qa("details.card,article.card,section.card,.card")
      .filter((card) => ["startup load control", "startup loading", "startup configuration", "startup presets"].includes(cardTitle(card)));

    const keep = startupCards.find((card) => cardTitle(card) === "startup load control")
      || q("#startup-config-form")?.closest("details.card,article.card,section.card,.card")
      || startupCards[0];

    startupCards.forEach((card) => {
      if (card !== keep) card.remove();
    });

    if (keep && keep.parentElement !== host) host.prepend(keep);

    const summary = keep && q("summary", keep);
    if (summary) summary.textContent = "Startup presets";

    const intro = keep && q("p.muted-text", keep);
    if (intro) intro.textContent = "Choose the additional project files loaded by each strength. Required startup, system and core files load automatically.";

    ensureAlwaysLoadedPanel(keep);

    const select = q("#startup-config-project");
    if (select && !q('option[value=""]', select)) {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Select project";
      placeholder.selected = true;
      placeholder.disabled = true;
      select.prepend(placeholder);
      select.value = "";
    }

    renamePresetLabels();
    cleanPresetTextareas();

    const form = q("#startup-config-form");
    if (form && !form.dataset.projectRequired) {
      form.dataset.projectRequired = "1";
      form.addEventListener("submit", (event) => {
        cleanPresetTextareas();
        const project = q("#startup-config-project");
        if (project && !project.value) {
          event.preventDefault();
          event.stopImmediatePropagation();
          const message = q("#startup-config-message");
          if (message) message.textContent = "Select a project before saving.";
          project.focus();
        }
      }, true);
      ["startup-files-low", "startup-files-medium", "startup-files-high"].forEach((id) => {
        q(`#${id}`)?.addEventListener("change", cleanPresetTextareas);
      });
    }

    qa("[id='startup-config-form']").slice(1).forEach((duplicate) => {
      duplicate.closest("details.card,article.card,section.card,.card")?.remove();
    });
  }

  function apply() {
    orderTabs();
    cleanStartupConfig();
  }

  function install() {
    const style = document.createElement("style");
    style.textContent = `
      #tab-config #config-zone-main{display:grid;gap:10px}
      #tab-config #startup-config-form{display:grid;gap:8px}
      #tab-config #startup-config-form textarea{width:100%;box-sizing:border-box;resize:vertical}
      #startup-always-loaded{margin:10px 0;padding:0;border:1px solid var(--border,#30384a);border-radius:10px}
      #startup-always-loaded>summary{padding:10px 12px;cursor:pointer;font-weight:600}
      #startup-always-loaded>p,#startup-always-loaded>ul{margin:0 12px 12px}
      #startup-always-loaded ul{display:grid;gap:5px;padding-left:20px}
      #startup-always-loaded code{overflow-wrap:anywhere}
      @media(max-width:700px){
        #tab-config #startup-config-form{grid-template-columns:1fr}
        #tab-config #startup-config-form select,
        #tab-config #startup-config-form textarea,
        #tab-config #startup-config-form button{width:100%;max-width:none}
      }
    `;
    document.head.appendChild(style);
    apply();
    document.querySelectorAll(".tab-btn").forEach((button) => {
      if (button.dataset.startupCleanupWired) return;
      button.dataset.startupCleanupWired = "1";
      button.addEventListener("click", () => requestAnimationFrame(apply));
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();