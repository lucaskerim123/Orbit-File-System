import crypto from "crypto";
import { query } from "./db.js";

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const DUMMY_SALT = "0".repeat(32);
const failedAttempts = new Map();

function scryptHash(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString("hex");
  return { salt, hash: scryptHash(pin, salt) };
}

function roleOf(user) { return user?.role === "admin" ? "admin" : "user"; }
function tokenHash(token) { return crypto.createHash("sha256").update(token).digest("hex"); }

export async function verifyLogin(username, pin) {
  const normalized = String(username || "").trim().toLowerCase();
  const attempt = failedAttempts.get(normalized);
  if (attempt?.lockedUntil > Date.now()) throw new Error("Account temporarily locked, try again later");

  const result = await query("SELECT * FROM users WHERE lower(username)=lower($1) LIMIT 1", [normalized]);
  const user = result.rows[0];
  const computed = scryptHash(pin, user?.pin_salt || DUMMY_SALT);
  const target = user?.pin_hash || computed;
  const match = !!user && user.status === "active" && crypto.timingSafeEqual(Buffer.from(computed,"hex"),Buffer.from(target,"hex"));
  if (!match) {
    const count = (attempt?.count || 0) + 1;
    failedAttempts.set(normalized, { count, lockedUntil: count >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0 });
    return null;
  }

  failedAttempts.delete(normalized);
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [tokenHash(token), user.id, expiresAt]
  );
  return { token, username: user.username, role: roleOf(user) };
}

export async function validateSession(token) {
  const result = await query(
    `SELECT s.user_id,s.expires_at,u.username,u.role,u.status
     FROM sessions s JOIN users u ON u.id=s.user_id
     WHERE s.token_hash=$1 LIMIT 1`, [tokenHash(token)]
  );
  const session = result.rows[0];
  if (!session || session.status !== "active" || new Date(session.expires_at) < new Date()) {
    if (session) await query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token)]);
    return null;
  }
  await query("UPDATE sessions SET last_seen_at=now() WHERE token_hash=$1", [tokenHash(token)]);
  return { username: session.username, role: roleOf(session), userId: session.user_id, expiresAt: session.expires_at };
}

export async function invalidateSession(token) {
  await query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token)]);
}
export async function listUsers() {
  const result = await query("SELECT username,role,status,email,avatar_url FROM users ORDER BY username");
  return result.rows;
}

export async function upsertUser(username, pin, role, email = null) {
  const normalized = String(username || "").trim().toLowerCase();
  if (!normalized) throw new Error("Username required");
  if (!/^\d{4,6}$/.test(pin || "")) throw new Error("PIN must be 4-6 digits");
  const { salt, hash } = hashPin(pin);
  await query(
    `INSERT INTO users(username,pin_salt,pin_hash,role,status,email)
     VALUES($1,$2,$3,$4,'active',$5)
     ON CONFLICT(username) DO UPDATE SET pin_salt=EXCLUDED.pin_salt,pin_hash=EXCLUDED.pin_hash,role=EXCLUDED.role,status='active',email=EXCLUDED.email,updated_at=now()`,
    [normalized, salt, hash, role === "admin" ? "admin" : "user", String(email || "").trim() || null]
  );
}

export async function removeUser(username) {
  const normalized = String(username || "").trim().toLowerCase();
  const target = await query("SELECT id,role FROM users WHERE lower(username)=lower($1)", [normalized]);
  if (!target.rows[0]) throw new Error("User not found");
  if (target.rows[0].role === "admin") {
    const admins = await query("SELECT count(*)::int AS count FROM users WHERE role='admin' AND status='active'");
    if (admins.rows[0].count <= 1) throw new Error("Can't delete the last admin account");
  }
  await query("DELETE FROM users WHERE id=$1", [target.rows[0].id]);
}

export async function replaceAllUsers(newUsers) {
  await query("DELETE FROM users");
  for (const user of newUsers) {
    await query("INSERT INTO users(username,pin_salt,pin_hash,role,status) VALUES($1,$2,$3,$4,'active')", [user.username,user.salt,user.hash,user.role === 'admin' ? 'admin' : 'user']);
  }
}



export async function getUserProfile(userId) {
  const result = await query(`
    SELECT u.id,u.username,u.email,u.role,u.status,u.created_at,u.updated_at,
      (SELECT count(*)::int FROM workspaces w WHERE w.owner_id=u.id AND w.status<>'archived') AS owned_workspaces,
      (SELECT count(*)::int FROM workspace_members wm WHERE wm.user_id=u.id) AS workspace_memberships,
      (SELECT count(*)::int FROM sessions s WHERE s.user_id=u.id AND s.expires_at>now()) AS active_sessions
    FROM users u WHERE u.id=$1 LIMIT 1`,[userId]);
  return result.rows[0] || null;
}

export async function updateUserProfile(userId,{email,pin}) {
  const fields=[]; const values=[];
  const add=(column,value)=>{values.push(value);fields.push(`${column}=$${values.length}`);};
  if(email!==undefined){
    const value=String(email||"").trim();
    if(value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) throw new Error("Invalid email address");
    add("email",value||null);
  }
  if(pin!==undefined && pin!==""){
    if(!/^\d{4,10}$/.test(String(pin))) throw new Error("PIN must be 4-10 digits");
    const {salt,hash}=hashPin(String(pin)); add("pin_salt",salt); add("pin_hash",hash);
  }
  if(fields.length){values.push(userId);await query(`UPDATE users SET ${fields.join(",")},updated_at=now() WHERE id=$${values.length}`,values);}
  return getUserProfile(userId);
}
