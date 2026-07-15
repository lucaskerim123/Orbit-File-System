import { query } from './db.js';

export const WORKSPACE_ACTIONS=['read','write','download','move','delete','create'];
export const WORKSPACE_ROLES=['editor','contributor','viewer'];
const FULL={read:true,write:true,download:true,move:true,delete:true,create:true};
const READ={read:true,write:false,download:true,move:false,delete:false,create:false};

export function roleDefaults(role){
  if(role==='editor') return {...FULL};
  if(role==='contributor') return {...FULL,delete:false};
  return {...READ};
}

export function normalizeWorkspacePath(value=''){
  return String(value).replace(/\\/g,'/').replace(/^\/+|\/+$/g,'');
}

export async function effectiveWorkspacePermissions(workspaceId,role,filepath=''){
  const base=roleDefaults(role);
  if(!WORKSPACE_ROLES.includes(role)) return base;
  const target=normalizeWorkspacePath(filepath);
  const row=(await query(`SELECT can_read,can_write,can_download,can_move,can_delete,can_create
    FROM workspace_permission_overrides
    WHERE workspace_id=$1 AND workspace_role=$2
      AND ($3=relative_path OR $3 LIKE relative_path || '/%' OR relative_path='')
    ORDER BY length(relative_path) DESC LIMIT 1`,[workspaceId,role,target])).rows[0];
  return row?{read:row.can_read,write:row.can_write,download:row.can_download,move:row.can_move,delete:row.can_delete,create:row.can_create}:base;
}
