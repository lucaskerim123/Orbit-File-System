# The Master Brain

Web panel for browsing and syncing the two Master Hive nodes:

- **PC node** — the `mcp-hive-server` instance running on your Windows PC, reached over its Cloudflare tunnel.
- **VPS node** — a second `mcp-hive-server` instance running on this VPS, always online.

The panel lets you browse/edit files on either node, and keeps the two in sync
(two-way, last-write-wins by modified time, with deletion propagation), with a
manual "Sync now" button, a configurable auto-sync interval, and a sync
history log.

## Setup on the VPS

1. Deploy a second `mcp-hive-server` instance on this same VPS (its own
   `HIVE_ROOT`, its own port, e.g. `3939`, `HIVE_API_KEY`, etc. — see that
   repo's own setup). It does not need a Cloudflare tunnel if the panel talks
   to it over `localhost`.
2. Clone this repo and install dependencies:
   ```
   git clone <this repo>
   cd the-master-brain
   npm install
   cp .env.example .env
   cp config.example.json config.json
   ```
3. Edit `.env`:
   - `NODE_PC_URL` / `NODE_PC_API_KEY` — your PC's public tunnel URL and its
     `HIVE_API_KEY`.
   - `NODE_VPS_URL` / `NODE_VPS_API_KEY` — usually `http://localhost:3939`
     and the VPS Hive instance's `HIVE_API_KEY`.
4. Adjust `config.json` if you want a different sync direction, interval, or
   include/exclude patterns (also editable later from the panel's Sync tab).
5. Create at least one login account (username + PIN):
   ```
   node scripts/add-user.mjs lucas 482917
   ```
   Add one line per person who needs access; re-running with an existing
   username replaces their PIN.
6. Start it: `npm start` (listens on `PANEL_PORT`, default `4000`).

## Login

Each user logs in with a username + PIN (not a shared key). PINs are hashed
(scrypt) in `users.json` — never stored in plain text — and a login issues a
12-hour session token. Five wrong PIN attempts for a username lock it out for
15 minutes. Manage accounts with `node scripts/add-user.mjs <username> <pin>`;
there's no in-app user management UI by design, since this is meant for a
small, trusted set of people with shell access to the server.

## Running as a service (systemd)

```ini
# /etc/systemd/system/master-brain.service
[Unit]
Description=The Master Brain panel
After=network.target

[Service]
WorkingDirectory=/opt/the-master-brain
ExecStart=/usr/bin/node server.js
Restart=on-failure
EnvironmentFile=/opt/the-master-brain/.env
User=master-brain

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reload
sudo systemctl enable --now master-brain
```

## Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name brain.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Put this behind HTTPS (e.g. certbot) since login PINs and session tokens are
sent from the browser.

## Running on IIS (Windows Server)

Node/Express doesn't run inside IIS's worker process natively. The
straightforward way to put this behind IIS is a reverse proxy — run the
Node app as its own background process on the VPS, and have IIS forward
requests to it (the same shape as the nginx setup above):

1. Run the panel as a persistent Windows process. The simplest option is
   [NSSM](https://nssm.cc/) (Non-Sucking Service Manager):
   ```
   nssm install MasterBrainPanel "C:\Program Files\nodejs\node.exe" "C:\the-master-brain\server.js"
   nssm set MasterBrainPanel AppDirectory "C:\the-master-brain"
   nssm start MasterBrainPanel
   ```
   (dotenv reads `.env` from `AppDirectory`, same as running `npm start`
   manually.) `pm2` with `pm2-windows-startup` is an equally fine alternative.
2. Install the **URL Rewrite** and **Application Request Routing (ARR)**
   modules for IIS (both free Microsoft downloads).
3. In IIS Manager, select the server node → Application Request Routing
   Cache → Server Proxy Settings → check "Enable proxy".
4. On the site you want to serve the panel from, add a URL Rewrite rule:
   - Match: pattern `(.*)`
   - Action: rewrite to `http://localhost:4000/{R:1}`
5. Bind that site to HTTPS with a certificate (IIS Manager → Bindings), since
   login PINs and session tokens travel over this connection.

An alternative is [`iisnode`](https://github.com/Azure/iisnode), which hosts
Node apps directly inside IIS's own worker process instead of proxying to a
separate one. It avoids running a second process, but it's much less
actively maintained and has its own quirks around static file serving and
process recycling — the reverse-proxy approach above is simpler and easier
to reason about, so it's the one recommended here.

## Notes

- `config.json`, `sync-state.json`, and `sync-history.jsonl` are runtime state
  (gitignored) — `sync-state.json` is what makes deletion propagation work,
  don't delete it unless you want the next sync to treat everything as new.
- ChatGPT's existing MCP connection to the Hive server(s) is untouched by this
  panel — point it at whichever node(s) you want it to use.
