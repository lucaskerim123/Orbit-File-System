import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { makeNodeClient } from "./node-client.js";
import { loadConfig, saveConfig } from "./config.js";
import { runSync, readHistory } from "./sync.js";
import { verifyLogin, validateSession, invalidateSession } from "./auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PANEL_PORT || 4000;

const pcClient = makeNodeClient("pc", process.env.NODE_PC_URL, process.env.NODE_PC_API_KEY);
const vpsClient = makeNodeClient("vps", process.env.NODE_VPS_URL, process.env.NODE_VPS_API_KEY);
const clients = { pc: pcClient, vps: vpsClient };

let config = await loadConfig();
let cronTask = null;
let syncInFlight = null;

function scheduleSync() {
  if (cronTask) cronTask.stop();
  if (!config.intervalMinutes || config.intervalMinutes <= 0) return;
  cronTask = cron.schedule(`*/${config.intervalMinutes} * * * *`, () => triggerSync());
}

async function triggerSync() {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSync(pcClient, vpsClient, config).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

scheduleSync();

const app = express();
app.use(express.json());

function sessionUser(req) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return validateSession(auth.slice(7));
}

app.post("/api/login", async (req, res) => {
  const { username, pin } = req.body || {};
  if (!username || !pin) return res.status(400).json({ error: "username and pin required" });
  try {
    const token = await verifyLogin(username, pin);
    if (!token) return res.status(401).json({ error: "Invalid username or PIN" });
    res.json({ token, username });
  } catch (err) {
    res.status(429).json({ error: err.message });
  }
});

app.post("/api/logout", (req, res) => {
  const auth = req.headers["authorization"];
  if (auth?.startsWith("Bearer ")) invalidateSession(auth.slice(7));
  res.json({ ok: true });
});

app.use("/api", (req, res, next) => {
  const username = sessionUser(req);
  if (!username) return res.status(401).json({ error: "Unauthorized" });
  req.username = username;
  next();
});

app.get("/api/status", async (req, res) => {
  const [pcOk, vpsOk] = await Promise.all([pcClient.ping(), vpsClient.ping()]);
  res.json({
    pc: { ok: pcOk, url: pcClient.baseUrl },
    vps: { ok: vpsOk, url: vpsClient.baseUrl },
    checkedAt: new Date().toISOString(),
  });
});

app.get("/api/files", async (req, res) => {
  try {
    const client = clients[req.query.node];
    if (!client) return res.status(400).json({ error: "node must be 'pc' or 'vps'" });
    res.json({ entries: await client.listFiles(req.query.subpath) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/file", async (req, res) => {
  try {
    const client = clients[req.query.node];
    if (!client) return res.status(400).json({ error: "node must be 'pc' or 'vps'" });
    res.json({ content: await client.readFile(req.query.path) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/file", async (req, res) => {
  try {
    const client = clients[req.body.node];
    if (!client) return res.status(400).json({ error: "node must be 'pc' or 'vps'" });
    await client.writeFile(req.body.path, req.body.content);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/file", async (req, res) => {
  try {
    const client = clients[req.query.node];
    if (!client) return res.status(400).json({ error: "node must be 'pc' or 'vps'" });
    await client.deleteFile(req.query.path);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/sync/run", async (req, res) => {
  try {
    const results = await triggerSync();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/sync/history", async (req, res) => {
  const limit = Number(req.query.limit) || 100;
  res.json({ entries: await readHistory(limit) });
});

app.get("/api/sync/config", (req, res) => {
  res.json(config);
});

app.put("/api/sync/config", async (req, res) => {
  config = { ...config, ...req.body };
  await saveConfig(config);
  scheduleSync();
  res.json(config);
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`The Master Brain panel listening on :${PORT}`);
});
