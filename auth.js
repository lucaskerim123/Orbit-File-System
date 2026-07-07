import fs from "fs/promises";
import crypto from "crypto";

const USERS_PATH = process.env.USERS_PATH || "./users.json";
const SESSIONS_PATH = process.env.SESSIONS_PATH || "./sessions.json";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_SALT = "0".repeat(32);

// Persisted to disk so a service restart/redeploy doesn't force everyone to
// log back in - same pattern as the Hive server's oauth_state.json.
const sessions = new Map(); // token -> { username, role, expiresAt }
const failedAttempts = new Map(); // normalized username -> { count, lockedUntil } (intentionally NOT persisted - a restart clearing lockouts is fine)

async function loadSessionsFromDisk() {
  try {
    const raw = JSON.parse(await fs.readFile(SESSIONS_PATH, "utf-8"));
    const now = Date.now();
    for (const [token, session] of Object.entries(raw)) {
      if (session.expiresAt > now) sessions.set(token, session);
    }
  } catch {
    // no sessions.json yet, or it's corrupt - start fresh rather than crash
  }
}
await loadSessionsFromDisk();

let saveQueued = false;
async function persistSessions() {
  if (saveQueued) return;
  saveQueued = true;
  queueMicrotask(async () => {
    saveQueued = false;
    try {
      await fs.writeFile(SESSIONS_PATH, JSON.stringify(Object.fromEntries(sessions)), "utf-8");
    } catch (err) {
      console.error("Failed to persist sessions:", err.message);
    }
  });
}

async function loadUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_PATH, "utf-8"));
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2), "utf-8");
}

function scryptHash(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: scryptHash(pin, salt) };
}

function roleOf(user) {
  return user?.role === "admin" ? "admin" : "user";
}

// Always runs the same scrypt cost whether or not the username exists, so a
// timing difference can't be used to enumerate valid usernames.
export async function verifyLogin(username, pin) {
  // Case-insensitive on purpose: mobile keyboards auto-capitalize the first
  // letter of text inputs by default, which would otherwise silently turn a
  // correct PIN into "Invalid username or PIN".
  const normalized = (username || "").trim().toLowerCase();
  const attempt = failedAttempts.get(normalized);
  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    throw new Error("Account temporarily locked, try again later");
  }

  const users = await loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === normalized);
  const computed = scryptHash(pin, user ? user.salt : DUMMY_SALT);
  const target = user ? user.hash : computed;
  const match = user && crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(target, "hex"));

  if (!match) {
    const fails = (attempt?.count || 0) + 1;
    failedAttempts.set(normalized, {
      count: fails,
      lockedUntil: fails >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : undefined,
    });
    return null;
  }

  failedAttempts.delete(normalized);
  const token = crypto.randomBytes(32).toString("hex");
  const role = roleOf(user);
  sessions.set(token, { username: user.username, role, expiresAt: Date.now() + SESSION_TTL_MS });
  persistSessions();
  return { token, username: user.username, role };
}

export function validateSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    persistSessions();
    return null;
  }
  return session;
}

export function invalidateSession(token) {
  sessions.delete(token);
  persistSessions();
}

// --- User management (admin panel) ------------------------------------

export async function listUsers() {
  const users = await loadUsers();
  return users.map((u) => ({ username: u.username, role: roleOf(u) }));
}

export async function upsertUser(username, pin, role) {
  const normalized = (username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username required");
  if (!/^\d{4,10}$/.test(pin || "")) throw new Error("PIN must be 4-10 digits");

  const users = await loadUsers();
  const { salt, hash } = hashPin(pin);
  const filtered = users.filter((u) => u.username.toLowerCase() !== normalized);
  filtered.push({ username: normalized, salt, hash, role: role === "admin" ? "admin" : "user" });
  await saveUsers(filtered);
}

export async function removeUser(username) {
  const normalized = (username || "").trim().toLowerCase();
  const users = await loadUsers();
  const target = users.find((u) => u.username.toLowerCase() === normalized);
  if (!target) throw new Error("User not found");

  const remainingAdmins = users.filter(
    (u) => roleOf(u) === "admin" && u.username.toLowerCase() !== normalized
  );
  if (roleOf(target) === "admin" && remainingAdmins.length === 0) {
    throw new Error("Can't delete the last admin account");
  }

  await saveUsers(users.filter((u) => u.username.toLowerCase() !== normalized));
  // Any of their active sessions should stop working immediately.
  let changed = false;
  for (const [token, session] of sessions) {
    if (session.username.toLowerCase() === normalized) {
      sessions.delete(token);
      changed = true;
    }
  }
  if (changed) persistSessions();
}

// --- Full reset (used when wiping all accounts) ------------------------

export async function replaceAllUsers(newUsers) {
  await saveUsers(newUsers);
  sessions.clear();
  persistSessions();
}
