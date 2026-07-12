import fs from "fs/promises";

const PERMISSIONS_PATH = process.env.FILE_PERMISSIONS_PATH || "./file-permissions.json";
export const FILE_ACTIONS = ["read", "write", "download", "move", "delete", "create"];
const ALLOW_ALL = Object.freeze(Object.fromEntries(FILE_ACTIONS.map((action) => [action, true])));
const DENY_ALL = Object.freeze(Object.fromEntries(FILE_ACTIONS.map((action) => [action, false])));

function normalizeRole(role) {
  return role === "admin" ? "admin" : "user";
}

function normalizePermissions(input, fallback = ALLOW_ALL) {
  return Object.fromEntries(FILE_ACTIONS.map((action) => [action, typeof input?.[action] === "boolean" ? input[action] : fallback[action]]));
}

function normalizeRule(rule) {
  if (!rule || typeof rule !== "object") return null;
  const path = normalizeFilePath(rule.path);
  // Automatic migration from the old user/admin visibility-only format.
  if (rule.role === "admin") return { path, permissions: { ...DENY_ALL } };
  if (rule.role === "user") return { path, permissions: { ...ALLOW_ALL } };
  return { path, permissions: normalizePermissions(rule.permissions) };
}

export function normalizeFilePath(input) {
  return String(input || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

async function loadPermissions() {
  try {
    const parsed = JSON.parse(await fs.readFile(PERMISSIONS_PATH, "utf-8"));
    return Array.isArray(parsed?.rules) ? parsed.rules.map(normalizeRule).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function savePermissions(rules) {
  await fs.writeFile(PERMISSIONS_PATH, JSON.stringify({ rules }, null, 2), "utf-8");
}

function matchRule(rulePath, targetPath) {
  const rule = normalizeFilePath(rulePath);
  const target = normalizeFilePath(targetPath);
  if (!rule) return true;
  return target === rule || target.startsWith(`${rule}/`);
}

async function matchingRule(filepath) {
  const target = normalizeFilePath(filepath);
  const rules = await loadPermissions();
  return rules
    .filter((r) => matchRule(r.path, target))
    .sort((a, b) => normalizeFilePath(b.path).length - normalizeFilePath(a.path).length)[0] || null;
}

export async function permissionsForPath(userRole, filepath) {
  if (normalizeRole(userRole) === "admin") return { ...ALLOW_ALL };
  const rule = await matchingRule(filepath);
  return rule ? normalizePermissions(rule.permissions) : { ...ALLOW_ALL };
}

export async function canAccessPath(userRole, filepath, action = "read") {
  if (!FILE_ACTIONS.includes(action)) throw new Error(`Unknown file permission action "${action}"`);
  return (await permissionsForPath(userRole, filepath))[action];
}

export async function filterEntriesForRole(entries, userRole, subpath = "") {
  if (normalizeRole(userRole) === "admin") {
    return Promise.all(entries.map(async (entry) => {
      const full = normalizeFilePath(subpath ? `${subpath}/${entry.name}` : entry.name);
      return { ...entry, permissions: await permissionsForPath(userRole, full) };
    }));
  }

  const out = [];
  for (const entry of entries) {
    const full = normalizeFilePath(subpath ? `${subpath}/${entry.name}` : entry.name);
    if (await canAccessPath(userRole, full, "read")) {
      out.push({ ...entry, permissions: await permissionsForPath(userRole, full) });
    }
  }
  return out;
}

export async function listPermissions() {
  const rules = await loadPermissions();
  return rules
    .map((r) => ({ path: normalizeFilePath(r.path), permissions: normalizePermissions(r.permissions) }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function setPermission(filepath, permissions) {
  const normalizedPath = normalizeFilePath(filepath);
  const rules = (await loadPermissions()).filter((r) => normalizeFilePath(r.path) !== normalizedPath);
  const normalizedPermissions = normalizePermissions(permissions);
  rules.push({ path: normalizedPath, permissions: normalizedPermissions });

  await savePermissions(rules.sort((a, b) => normalizeFilePath(a.path).localeCompare(normalizeFilePath(b.path))));
  return { path: normalizedPath, permissions: normalizedPermissions };
}

export async function clearPermission(filepath) {
  const normalizedPath = normalizeFilePath(filepath);
  const rules = (await loadPermissions()).filter((r) => normalizeFilePath(r.path) !== normalizedPath);
  await savePermissions(rules);
  return { path: normalizedPath, inherited: true };
}
