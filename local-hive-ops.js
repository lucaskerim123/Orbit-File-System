// Read-only fallback so the panel can still browse/view/download files when
// the OrbitFS MCP server isn't running - reads straight off disk instead of
// going through the MCP's REST API. Only list/read/download are implemented
// here (mirrors the read side of orbitfs-mcp/hive-ops.js, including its BOM
// handling, so file contents come back identical either way). Writes
// (upload, delete, move, mkdir, trash, sort) are NOT duplicated here - those
// need the MCP's protected-root and trash-workflow logic, which shouldn't
// live in two places, so they still require the MCP server to be up.
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import dotenv from "dotenv";

// Parsed (not injected into process.env) so this doesn't clash with the
// panel's own .env - the MCP's .env also sets PORT/HIVE_API_KEY, which are
// meaningless (and wrong) in the panel's process.
export function resolveLocalHiveRoot(hiveServerDir) {
  try {
    const parsed = dotenv.parse(fsSync.readFileSync(path.join(hiveServerDir, ".env"), "utf8"));
    return parsed.HIVE_ROOT || null;
  } catch {
    return null;
  }
}

function decodeText(buf) {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.slice(2).toString("utf16le");
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return buf.slice(2).swap16().toString("utf16le");
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.slice(3).toString("utf-8");
  return buf.toString("utf-8");
}

export function makeLocalOps(root) {
  const ROOT = path.resolve(root);

  function safeResolve(rel) {
    const full = path.resolve(ROOT, rel || ".");
    if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
      throw new Error("Path escapes the Hive root");
    }
    return full;
  }

  async function listFiles(subpath) {
    const dir = safeResolve(subpath);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return Promise.all(
      entries.map(async (e) => {
        if (e.isDirectory()) return { name: e.name, type: "dir" };
        const stat = await fs.stat(path.join(dir, e.name));
        return { name: e.name, type: "file", size: stat.size, mtime: stat.mtime.toISOString() };
      })
    );
  }

  async function readFile(filepath) {
    return decodeText(await fs.readFile(safeResolve(filepath)));
  }

  async function downloadStream(filepath) {
    const full = safeResolve(filepath);
    await fs.stat(full); // throws if missing, same failure mode as the MCP route
    return { stream: fsSync.createReadStream(full), filename: path.basename(full) };
  }

  return { ROOT, safeResolve, listFiles, readFile, downloadStream };
}
