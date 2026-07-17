# OrbitFS paid-module boundary

Purpose: define what stays public, what becomes protected/private, and what remains locally licence-gated.

## Public open-core code

Keep these in the public repositories:

- Panel shell, login, Systems UI, Config UI, basic file browser.
- MCP shell and public/free MCP tools.
- Licence client code that talks to the Azure Licence API.
- Licence status UI and service-control gates.
- Add-on loader hooks and placeholder add-on manifests.
- Basic stub/demo versions of Sorter and Workspaces that do not contain paid logic.

Public code can be edited by users. It must not contain anything that is meant to be commercially protected.

## Protected/private code

Move or keep these outside public GitHub:

- Real Sorter engine logic.
- Real Workspaces implementation if sold as a paid module.
- Any advanced MCP tools that are paid.
- Azure Licence API implementation.
- Azure Licence Manager admin UI.
- Customer build scripts and release packaging.
- Any signing keys, API tokens, deployment credentials, or private update endpoints.

These should live in a private repository, private package, protected release artifact, or hosted service controlled by OrbitFS.

## Local licence gates that should remain

Keep local checks because they stop accidental or casual misuse:

- Panel requires `orbitfs_panel` before serving `/api`.
- MCP requires `orbitfs_mcp` before serving `/mcp`.
- Workspaces routes require `orbitfs_workspaces` before workspace-only APIs run.
- Sorter service requires `orbitfs_sorter` before doing sorting work.
- Panel start/restart checks licence before starting MCP or Sorter.
- Blocked service components are stopped by Panel enforcement.

These are enforcement layers, not absolute protection. They are still editable in public code.

## Security rule

Do not rely on frontend hiding, button disabling, or public local code as the source of truth.

The source of truth is:

- Azure Licence API
- signed entitlement response/token
- private paid modules
- hosted services controlled by OrbitFS

## Target architecture

Panel public repo:

- open shell
- licence UI
- service gates
- plugin loader
- no paid module internals

MCP public repo:

- open MCP shell
- licence gates
- public/free tools
- no paid tool internals

Private paid modules:

- `orbitfs-sorter-pro`
- `orbitfs-workspaces-pro`
- paid MCP tool packs

Azure only:

- licence creation/editing
- licence validation
- audit history
- entitlement signing

## Migration order

1. Keep current gates stable.
2. Define paid module interfaces.
3. Replace public Sorter with stub/loader.
4. Move real Sorter to protected package or private release artifact.
5. Replace public Workspaces with stub/loader if Workspaces is commercial.
6. Move real Workspaces to protected package or private release artifact.
7. Add signed entitlement verification.
8. Add private update/install path from Azure/customer release channel.

## Notes

A user can always remove checks from public local code. The goal is to make that useless for paid features by not shipping paid feature logic publicly.