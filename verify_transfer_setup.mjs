import { query } from './db.js';
const table = await query(`SELECT to_regclass('public.workspace_transfer_requests') AS table_name`);
const workspaces = await query(`
  SELECT w.id,w.name,u.username AS owner
  FROM workspaces w
  LEFT JOIN users u ON u.id=w.owner_id
  WHERE w.is_main=false
  ORDER BY w.created_at
`);
const users = await query(`SELECT username,email FROM users WHERE status='active' ORDER BY username`);
console.log(JSON.stringify({ table:table.rows[0], workspaces:workspaces.rows, users:users.rows }));
process.exit(0);
