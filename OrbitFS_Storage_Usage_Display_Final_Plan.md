# OrbitFS Storage Usage Display — Final Plan

## 1. Workspace Header Meter

Show a compact storage meter beneath the workspace selector.

Example for a limited workspace:

```text
Storage
1.24 GB used of 2.50 GB
[██████████░░░░░░░░░░] 49.6%
```

Example for Main Workspace:

```text
Storage
83.6 GB used
Unlimited quota
```

Display states:

- Normal: below 75%
- Warning: 75–89%
- Critical: 90–99%
- Full: 100%
- Suspended: usage remains visible but file access is blocked for non-admins

Refresh storage data after uploads, edits, deletes, moves, trash operations, workspace switching, quota changes, and manual refresh.

## 2. Workspace Manager Cards

Each workspace card displays:

- Workspace name
- Owner
- Current user role
- Status
- Used storage
- Quota
- Free storage
- Usage percentage
- Full-width usage bar

Suspended workspaces remain visible with their suspension reason and current usage. Non-admin users cannot open suspended workspace files. Admins can still inspect and manage them.

## 3. Workspace Storage Details

Add a **Storage details** action to each workspace card.

Display:

- Total used
- Quota
- Remaining storage
- File count
- Folder count
- Trash usage
- Largest files
- Largest folders
- Last calculated time
- Manual refresh action

Storage breakdown categories:

- Documents
- Images
- Video
- Audio
- Archives
- Code
- Other
- Trash

Do not run a full category scan every time the Workspace tab opens. Cache the breakdown and recalculate on demand or after meaningful file changes.

## 4. Admin Storage Overview

Add a compact **Storage** section inside the admin-only System tab.

Display global totals:

- Drive capacity
- Main Workspace usage
- Branched Workspace usage
- Reserved space
- Free physical space
- Total configured workspace quotas

List all workspaces ordered by usage with owner, status, quota, physical root, last scan time, and warning state.

## 6. Daily Upload Allowance

Daily upload allowance is separate from total workspace quota.

Examples:

- Workspace quota: 2.5 GB total
- Daily upload allowance: 500 MB per rolling 24 hours or per calendar day
- Admin override: unlimited or custom allowance

Display on the workspace card and storage details page:

```text
Today uploaded: 184 MB of 500 MB
[███████░░░░░░░░░░░░░] 36.8%
Resets: 12:00 AM local time
```

Recommended database fields:

- daily_upload_limit_bytes
- daily_upload_used_bytes
- daily_upload_reset_at
- daily_upload_mode: default, custom, unlimited
- last_upload_recorded_at

Daily allowance rules:

- Count uploaded bytes, not final compressed size.
- File edits count only the positive size increase, not the entire rewritten file.
- Moving or renaming files inside the same workspace does not count.
- Copying files into another workspace counts against the destination workspace.
- Failed or rejected uploads do not count.
- Deleted files do not refund the daily allowance.
- Admins can change a workspace allowance or grant a temporary override.
- Reaching the daily limit blocks uploads and file growth, but downloads, reads, deletes and renames remain available.

## 7. MCP Enforcement

The Panel and MCP must use the same PostgreSQL counters and enforcement service.

Before any MCP upload, write, import or cross-workspace copy:

1. Resolve the workspace and acting user.
2. Verify workspace membership and role.
3. Reject suspended workspaces for non-admins.
4. Check total workspace quota.
5. Check the workspace daily upload allowance.
6. Reserve the incoming byte count atomically.
7. Perform the file operation.
8. Commit actual usage or release the reservation on failure.

This prevents users from bypassing Panel restrictions through ChatGPT, Claude or another MCP client.
