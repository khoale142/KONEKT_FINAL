import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { signWorkspaceToken } from '../../utils/jwt.js';
import { WORKSPACE_TYPES } from '../../constants/roles.js';

export async function getMyWorkspaces(userId) {
  // 1. Get owned tenants
  const ownedTenantsResult = await query(
    `select t.id, t.name, t.slug, t.status, t.created_at
     from tenants t
     join tenant_owners to_owner on to_owner.tenant_id = t.id
     where to_owner.user_id = $1 and t.status = 'ACTIVE'
     order by t.created_at desc`,
    [userId]
  );
  
  const ownedTenants = ownedTenantsResult.rows;

  // Enhance owned tenants with their stores
  if (ownedTenants.length > 0) {
    const tenantIds = ownedTenants.map(t => t.id);
    const placeholders = tenantIds.map((_, i) => `$${i + 1}`).join(', ');
    const storesResult = await query(
      `select id, tenant_id, name, address, invite_code, status
       from stores
       where tenant_id in (${placeholders}) and status = 'ACTIVE'`,
      tenantIds
    );
    
    const storeMap = new Map();
    for (const store of storesResult.rows) {
      if (!storeMap.has(store.tenant_id)) {
        storeMap.set(store.tenant_id, []);
      }
      storeMap.get(store.tenant_id).push(store);
    }
    
    for (const tenant of ownedTenants) {
      tenant.stores = storeMap.get(tenant.id) || [];
    }
  }

  // 2. Get staff stores
  const staffStoresResult = await query(
    `select s.id, s.name, s.address, s.status, t.id as tenant_id, t.name as tenant_name
     from stores s
     join store_staff ss on ss.store_id = s.id
     join tenants t on t.id = s.tenant_id
     where ss.user_id = $1 and s.status = 'ACTIVE' and t.status = 'ACTIVE'
     order by t.name asc, s.name asc`,
    [userId]
  );

  return {
    ownedTenants,
    staffStores: staffStoresResult.rows
  };
}

export async function selectWorkspace(userId, { workspaceType, workspaceId }) {
  if (!workspaceType || !workspaceId) {
    throw new ApiError(400, 'Workspace type and id are required.');
  }

  const type = workspaceType.toUpperCase();
  if (!Object.values(WORKSPACE_TYPES).includes(type)) {
    throw new ApiError(400, 'Invalid workspace type.');
  }

  let role = 'STAFF';
  let tenantId = null;

  if (type === WORKSPACE_TYPES.TENANT) {
    const check = await query(
      `select 1 from tenant_owners 
       join tenants on tenants.id = tenant_owners.tenant_id
       where tenant_owners.user_id = $1 and tenant_owners.tenant_id = $2 and tenants.status = 'ACTIVE'`,
      [userId, workspaceId]
    );
    
    if (!check.rows[0]) {
      throw new ApiError(403, 'Access denied to this tenant.');
    }
    tenantId = workspaceId;
    role = 'OWNER';
  } else if (type === WORKSPACE_TYPES.STORE) {
    // Check if user is staff of this store OR owner of the tenant that owns this store
    const storeInfo = await query(
      `select s.tenant_id
       from stores s
       join tenants t on t.id = s.tenant_id
       where s.id = $1 and s.status = 'ACTIVE' and t.status = 'ACTIVE'`,
      [workspaceId]
    );
    
    if (!storeInfo.rows[0]) {
      throw new ApiError(404, 'Store not found or inactive.');
    }
    
    tenantId = storeInfo.rows[0].tenant_id;
    
    const isOwnerCheck = await query(
      `select 1 from tenant_owners where user_id = $1 and tenant_id = $2`,
      [userId, tenantId]
    );
    
    if (isOwnerCheck.rows[0]) {
      // Owners have manager privileges in all their stores
      role = 'MANAGER';
    } else {
      const isStaffCheck = await query(
        `select role from store_staff where user_id = $1 and store_id = $2`,
        [userId, workspaceId]
      );
      
      if (!isStaffCheck.rows[0]) {
        throw new ApiError(403, 'Access denied to this store.');
      }
      role = isStaffCheck.rows[0].role || 'STAFF';
    }
  }

  const token = signWorkspaceToken({ userId, workspaceType: type, workspaceId, tenantId, role });
  return { token };
}
