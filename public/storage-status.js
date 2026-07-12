(() => {
  let refreshTimer = null;

  function ensureStorageDetails() {
    const bar = document.getElementById("disk-bar");
    if (!bar) return null;
    let details = document.getElementById("hive-storage-details");
    if (!details) {
      details = document.createElement("div");
      details.id = "hive-storage-details";
      details.className = "hive-storage-details";
      details.innerHTML = `
        <div><span>Used</span><strong id="hive-storage-used">—</strong></div>
        <div><span>Free</span><strong id="hive-storage-free">—</strong></div>
        <div><span>Total</span><strong id="hive-storage-total">—</strong></div>
        <div><span>Usage</span><strong id="hive-storage-percent">—</strong></div>
        <p id="hive-storage-path" class="muted-text">Detecting Hive storage path…</p>`;
      bar.insertAdjacentElement("afterend", details);
    }
    return details;
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatGb(value) {
    const parsed = number(value);
    return parsed === null ? "Unknown" : `${parsed.toLocaleString(undefined, { maximumFractionDigits: 1 })} GB`;
  }

  function renderStorage(disk = {}) {
    const details = ensureStorageDetails();
    if (!details) return;
    const used = number(disk.usedGB);
    const free = number(disk.freeGB);
    const total = number(disk.totalGB);
    const calculated = total && used !== null ? (used / total) * 100 : null;
    const percent = number(disk.usedPercent) ?? calculated;
    const drive = disk.drive || disk.root || "Hive volume";

    const summary = document.getElementById("disk-summary");
    const label = summary?.parentElement?.querySelector("span:first-child");
    if (label) label.textContent = `Hive storage (${drive})`;
    if (summary) summary.textContent = free === null ? "status unavailable" : `${formatGb(free)} free`;

    document.getElementById("hive-storage-used").textContent = formatGb(used);
    document.getElementById("hive-storage-free").textContent = formatGb(free);
    document.getElementById("hive-storage-total").textContent = formatGb(total);
    document.getElementById("hive-storage-percent").textContent = percent === null ? "Unknown" : `${Math.round(percent)}%`;
    document.getElementById("hive-storage-path").textContent = disk.path
      ? `Hive path: ${disk.path}`
      : (disk.error || "Hive storage path unavailable.");

    const fill = document.getElementById("disk-bar-fill");
    if (fill) {
      const safePercent = Math.max(0, Math.min(100, percent || 0));
      fill.style.width = `${safePercent}%`;
      fill.classList.toggle("storage-warning", safePercent >= 80 && safePercent < 90);
      fill.classList.toggle("storage-critical", safePercent >= 90);
    }
  }

  async function refreshHiveStorage() {
    if (!state?.token || !document.getElementById("disk-bar")) return;
    try {
      const status = await api("/api/system/status");
      renderStorage(status.disk || {});
    } catch (error) {
      renderStorage({ error: error.message });
    }
  }

  document.getElementById("system-refresh-btn")?.addEventListener("click", () => setTimeout(refreshHiveStorage, 100));
  document.getElementById("tab-system-btn")?.addEventListener("click", () => setTimeout(refreshHiveStorage, 100));
  document.querySelector('[data-tab="system"]')?.addEventListener("click", () => setTimeout(refreshHiveStorage, 100));

  const observer = new MutationObserver(() => {
    if (ensureStorageDetails() && !refreshTimer) {
      refreshHiveStorage();
      refreshTimer = setInterval(refreshHiveStorage, 60000);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureStorageDetails();
  refreshHiveStorage();
})();