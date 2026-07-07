import fs from "fs/promises";
import crypto from "crypto";

const USERS_PATH = process.env.USERS_PATH || "./users.json";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_SALT = "0".repeat(32);

const sessions = new Map(); // token -> { username, expiresAt }
const failedAttempts = new Map(); // username -> { count, lockedUntil }

async function loadUsers() {
  try {
    return JSON.parse(await fs.readFile(USERS_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function scryptHash(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: scryptHash(pin, salt) };
}

// Always runs the same scrypt cost whether or not the username exists, so a
// timing difference can't be used to enumerate valid usernames.
export async function verifyLogin(username, pin) {
  const attempt = failedAttempts.get(username);
  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    throw new Error("Account temporarily locked, try again later");
  }

  const users = await loadUsers();
  const user = users.find((u) => u.username === username);
  const computed = scryptHash(pin, user ? user.salt : DUMMY_SALT);
  const target = user ? user.hash : computed;
  const match = user && crypto.timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(target, "hex"));

  if (!match) {
    const fails = (attempt?.count || 0) + 1;
    failedAttempts.set(username, {
      count: fails,
      lockedUntil: fails >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : undefined,
    });
    return null;
  }

  failedAttempts.delete(username);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { username, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function validateSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.username;
}

export function invalidateSession(token) {
  sessions.delete(token);
}
