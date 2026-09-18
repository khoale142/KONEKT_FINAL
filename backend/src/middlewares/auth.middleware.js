import { query } from '../config/db.js';
import { WORKSPACE_TYPES } from '../constants/roles.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Unauthorized. Please login first.');
    }

    const payload = verifyAccessToken(token);
    const result = await query(
      `select id, username, email, full_name, status, last_login_at, created_at, updated_at
       from app_users
       where id = $1 and deleted_at is null
       limit 1`,
      [payload.userId],
    );

    const user = result.rows[0];

    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'User session is invalid or inactive.');
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      status: user.status,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    };

    req.workspace = {
      type: payload.workspaceType || null,
      id: payload.workspaceId || null,
      tenantId: null,
      storeId: null,
      isOwner: false,
      role: null,
    };

    if (req.workspace.type === WORKSPACE_TYPES.TENANT) {
      req.workspace.tenantId = req.workspace.id;
      
      const ownerCheck = await query(
        `select 1 from tenant_owners where user_id = $1 and tenant_id = $2`,
        [req.user.id, req.workspace.tenantId]
      );
      if (!ownerCheck.rows[0]) {
        throw new ApiError(403, 'Access denied. You are not the owner of this tenant.');
      }
      req.workspace.isOwner = true;
      req.workspace.role = 'OWNER';
    } else if (req.workspace.type === WORKSPACE_TYPES.STORE) {
      req.workspace.storeId = req.workspace.id;
      
      const storeInfo = await query(
        `select s.tenant_id
         from stores s
         join tenants t on t.id = s.tenant_id
         where s.id = $1 and s.status = 'ACTIVE' and t.status = 'ACTIVE'`,
        [req.workspace.storeId]
      );
      if (!storeInfo.rows[0]) {
        throw new ApiError(404, 'Store not found.');
      }
      req.workspace.tenantId = storeInfo.rows[0].tenant_id;
      
      const ownerCheck = await query(
        `select 1 from tenant_owners where user_id = $1 and tenant_id = $2`,
        [req.user.id, req.workspace.tenantId]
      );
      req.workspace.isOwner = !!ownerCheck.rows[0];
      
      if (!req.workspace.isOwner) {
        const staffCheck = await query(
          `select role from store_staff where user_id = $1 and store_id = $2`,
          [req.user.id, req.workspace.storeId]
        );
        if (!staffCheck.rows[0]) {
          throw new ApiError(403, 'Access denied. You are not staff of this store.');
        }
        req.workspace.role = staffCheck.rows[0].role || 'STAFF';
      } else {
        req.workspace.role = 'MANAGER';
      }
    }

    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, 'Unauthorized. Please login again.'));
  }
}
