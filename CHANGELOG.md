# Changelog

All notable changes to the OrbitFS Panel are documented here. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Beta 2.0] — 2026-07-16

Since `BetaV1` (2026-07-15).

### Added
- **Licence enforcement.** Installation-bound licence key, validated against the OrbitFS licence API, cached locally with a 3-hour refresh, a 72-hour offline grace period, and a 1-minute remote-revocation signal poll. Gates four components independently (Panel, MCP, Workspaces, Sorter). Setup wizard now collects and validates a licence key.
- **MCP client access grants.** Per-workspace admin toggle (`mcp_ui_enabled`, default off), owner/admin per-member grants, and Cloudflare Access automation that manages a dedicated "MCP Guests" policy on grant/revoke without touching the owner's own login rule. Disabling MCP for a workspace cascades to revoke every active grant.
- **Workspace owners can self-grant MCP access.** The per-member grant toggle previously hid the owner's own row; a non-admin owner needs an explicit grant same as anyone else, so this was a visibility bug, not a permissions one.
- **MCP Link panel** on workspace cards showing live connection URL and grant status.
- **Storage change requests.** A workspace owner can request a quota change; an admin approves or denies with a message.
- **Archived workspace restore requests.** Archiving previously had no way back — the workspace row and its files were left untouched, but every read path excluded `status='archived'`, making it unreachable even to the admin who archived it. Owners can now request a restore on their own archived workspace; an admin approves or denies, and approval flips it back to active.
- **MCP grant notifications carry the real connect link.** Granting a member MCP access used to send a vague "connect Claude or ChatGPT" notice with no actual URL. The notification now embeds the link with a one-click copy button.
- **Cloudflare Access One-Time PIN login.** The only identity provider was gated to Cloudflare account members, which silently blocked every new workspace member from authenticating at all, regardless of their email being allow-listed. Added a One-Time PIN identity provider so anyone on the email allow-list can actually get in.
- Maintenance mode system and enhanced critical alert UI.
- Addon system for dynamic feature loading, including handling for "parked" (disabled but present) addons.
- Global broadcast alerts/messages/warnings now always attributed to **"OrbitFS System"** in the notification feed, regardless of which admin actually sent them.

### Fixed
- Dead MCP connector URL (`mcp.incendiarynetworks.cc`, no DNS record) — new workspace owners got a link that could never resolve. Fixed to the correct domain in config and code fallbacks.
- Character-encoding issues and Sorter reliability.
- Google Drive upload reliability.

### Changed
- `orbitfs_schema.sql` regenerated from a live `pg_dump --schema-only` — the previous copy was missing 12 of 23 tables and no longer reflected the real database.
- Removed unused Remote Desktop Commander scripts and other stale development artifacts.

### Known / Operational
- Both this repo and `orbitfs-mcp` auto-commit and auto-push on every file save. Convenient, but there's no review window before a change lands on `main` — worth keeping in mind heading toward a wider release.
