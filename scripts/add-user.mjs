#!/usr/bin/env node
import fs from "fs/promises";
import { hashPin } from "../auth.js";

const [, , username, pin] = process.argv;
const USERS_PATH = process.env.USERS_PATH || "./users.json";

if (!username || !pin) {
  console.error("Usage: node scripts/add-user.mjs <username> <pin>");
  process.exit(1);
}
if (!/^\d{4,10}$/.test(pin)) {
  console.error("PIN must be 4-10 digits");
  process.exit(1);
}

let users = [];
try {
  users = JSON.parse(await fs.readFile(USERS_PATH, "utf-8"));
} catch {
  // no users.json yet
}

const { salt, hash } = hashPin(pin);
users = users.filter((u) => u.username !== username);
users.push({ username, salt, hash });
await fs.writeFile(USERS_PATH, JSON.stringify(users, null, 2));
console.log(`User '${username}' saved to ${USERS_PATH}`);
