import { query } from "./db.js";
import { getWorkspaceForUser } from "./workspaces.js";
import { addGuestEmail, removeGuestEmail } from "./cloudflare-access.js";
import { createNotification } from "./notifications.js";

function assertOwnerOrAdmin(workspace, systemRole) {
  if (systemRole !== "admin" && workspace.permission !== "owner") throw new Error("Workspace owner access required");
}

export async function listWorkspaceMcpGrants(workspaceId, actorId, systemRole) {
  const workspace = await getWorkspaceForUser(workspaceId, actorId, systemRole);
  if (!workspace) throw new Error("Workspace not found or access denied");
  const result = await query(
    `SELECT g.user_id,u.username,u.email,g.granted_at,g.granted_by,gb.username AS granted_by_username
     FROM workspace_mcp_grants g
     JOIN users u ON u.id=g.user_id
     LEFT JOIN users gb ON gb.id=g.granted_by
     WHERE g.workspace_id=$1 AND g.revoked_at IS NULL
     ORDER BY g.granted_at DESC`,
    [workspaceId]
  );
  return result.rows;
}

export async function grantWorkspaceMcpAccess(workspaceId, targetUserId, actorId, systemRole) {
  const workspace = await getWorkspaceForUser(workspaceId, actorId, systemRole);
  if (!workspace) throw new Error("Workspace not found or access denied");
  assertOwnerOrAdmin(workspace, systemRole);
  if (!workspace.mcp_ui_enabled) throw new Error("MCP access is not enabled for this workspace - an admin must enable it first");
  const member = (await query(
    `SELECT u.id,u.username,u.email FROM workspace_members wm JOIN users u ON u.id=wm.user_id WHERE wm.workspace_id=$1 AND wm.user_id=$2`,
    [workspaceId, targetUserId]
  )).rows[0];
  if (!member) throw new Error("User is not a member of this workspace");
  if (!member.email) throw new Error(`${member.username} has no email on file - add one before granting MCP access`);
  await addGuestEmail(member.email);
  await query(
    `INSERT INTO workspace_mcp_grants(workspace_id,user_id,granted_by,granted_at,revoked_at)
     VALUES($1,$2,$3,now(),NULL)
     ON CONFLICT(workspace_id,user_id) DO UPDATE SET granted_by=EXCLUDED.granted_by,granted_at=now(),revoked_at=NULL`,
    [workspaceId, targetUserId, actorId]
  );
  await createNotification({
    recipientUserId: targetUserId, workspaceId, actorUserId: actorId,
    category: "membership_changes", eventType: "mcp_access_granted", title: "MCP access granted",
    message: `You were granted MCP access to ${workspace.name}. Connect Claude or ChatGPT to link it.`, severity: "success",
  });
  return listWorkspaceMcpGrants(workspaceId, actorId, systemRole);
}

export async function revokeWorkspaceMcpAccess(workspaceId, targetUserId, actorId, systemRole) {
  const workspace = await getWorkspaceForUser(workspaceId, actorId, systemRole);
  if (!workspace) throw new Error("Workspace not found or access denied");
  assertOwnerOrAdmin(workspace, systemRole);
  const member = (await query(`SELECT email,username FROM users WHERE id=$1`, [targetUserId])).rows[0];
  if (member?.email) await removeGuestEmail(member.email);
  await query(`UPDATE workspace_mcp_grants SET revoked_at=now() WHERE workspace_id=$1 AND user_id=$2 AND revoked_at IS NULL`, [workspaceId, targetUserId]);
  await createNotification({
    recipientUserId: targetUserId, workspaceId, actorUserId: actorId,
    category: "membership_changes", eventType: "mcp_access_revoked", title: "MCP access revoked",
    message: `Your MCP access to ${workspace.name} was revoked.`, severity: "warning",
  });
  return listWorkspaceMcpGrants(workspaceId, actorId, systemRole);
}

// Used when an admin disables MCP for the whole workspace - best-effort per
// grant so one Cloudflare failure doesn't block revoking the rest; only
// grants that actually cleared in Cloudflare get marked revoked in the DB,
// so the DB never claims a revoke that didn't really happen upstream.
export async function revokeAllWorkspaceMcpGrants(workspaceId) {
  const grants = (await query(
    `SELECT g.user_id,u.email,u.username FROM workspace_mcp_grants g JOIN users u ON u.id=g.user_id WHERE g.workspace_id=$1 AND g.revoked_at IS NULL`,
    [workspaceId]
  )).rows;
  const failed = [];
  for (const grant of grants) {
    try {
      if (grant.email) await removeGuestEmail(grant.email);
      await query(`UPDATE workspace_mcp_grants SET revoked_at=now() WHERE workspace_id=$1 AND user_id=$2`, [workspaceId, grant.user_id]);
    } catch {
      failed.push(grant.username);
    }
  }
  return { revoked: grants.length - failed.length, failed };
}
