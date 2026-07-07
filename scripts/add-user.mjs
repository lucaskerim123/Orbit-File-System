#!/usr/bin/env node
import fs from "fs/promises";
import { hashPin } from "../auth.js";

const [, , username, pin, role] = process.argv;
const USERS_PATH = process.env.USERS_PATH || "./users.json";

if (!username || !pin) {
  console.error("Usage: node scripts/add-user.mjs <username> <pin> [role]");
  console.error("  role defaults to 'admin' when this is the first account, else 'user'");
  process.exit(1);
}
if (!/^\d{4,10}$/.test(pin)) {
  console.error("PIN must be 4-10 digits");
  process.exit(1);
}
if (role && role !== "admin" && role !== "user") {
  console.error("role must be 'admin' or 'user'");
  process.exit(1);
}

let users = [];
try {
  const parsed = JSON.parse(await fs.readFile(USERS_PATH, "utf-8"));
  users = Array.isArray(parsed) ? parsed : [];
} catch {
  // no users.json yet
}

const finalRole = role || (users.length === 0 ? "admin" : "user");
const { salt, hash } = hashPin(pin);
users = users.filter((u) => u.username.toLowerCase() !== username.toLowerCase());
users.push({ username: username.trim().toLowerCase(), salt, hash, role: finalRole });
await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
console.log(`User '${username}' (${finalRole}) saved to ${USERS_PATH}`);
