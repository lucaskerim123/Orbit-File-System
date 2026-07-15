# CLAUDE.md

Web panel for OrbitFS (the MCP server lives in the sibling repo
`orbitfs-mcp` — see its CLAUDE.md for service topology, the NSSM restart
recipe, and PowerShell-from-Bash gotchas; same box, same rules).

## Static frontend, no build step

`public/*.js` are served as-is — editing one takes effect on next page
load, no service restart needed (only `server.js` changes need
`Restart-Service OrbitFSPanel -Force`).

**Cache-busting is manual and chained.** Scripts are loaded with
`?v=DATE-tag` query strings, and some are loaded dynamically from inside
other scripts (`index.html` → `permissions.js?v=...` → injects
`layout-tweaks.js?v=...` → injects `drive-upload.js?v=...`). Editing a
file's content is not enough to bust the cache — bump the version tag at
*every* link in that file's load chain, not just the file itself.

## Preset/level enumeration sites drift

Anywhere the code lists out strength levels (`low`/`medium`/`high`/
`custom1`/`custom2`), check every site independently — the frontend
save-payload builder and the backend save handler each had their own
hardcoded `["low","medium","high"]` list that silently dropped
`custom1`/`custom2`, in two unrelated places (`app.js` submit handler and
`server.js`'s `/api/system/startup-config` POST). Fixing one without the
other looks like a fix but isn't.

## Google Drive integration

OAuth client ID is shared panel-wide via the `system_settings` Postgres
table (`GET`/`PATCH /api/(system/)drive-config`), not per-browser
`localStorage` — one admin sets it once for everyone. Each user still does
their own Google sign-in/consent separately; that part is unrelated and
per-user by design.
