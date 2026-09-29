import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAdminAction } from '../../utils/adminAudit.js';

export async function listAccounts({
  search = '',
  status = 'ALL',
  relation = 'ALL',
  sort = 'newest',
  page = 1,
  limit = 10,
}) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const parsedLimit = parseInt(limit, 10);

  const conditions = ['u.deleted_at IS NULL'];
  const params = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      `(lower(u.full_name) LIKE $${paramIndex} OR lower(u.username) LIKE $${paramIndex} OR lower(u.email) LIKE $${paramIndex} OR lower(u.id::text) LIKE $${paramIndex})`
    );
    params.push(q);
    paramIndex++;
  }

  if (status && status !== 'ALL') {
    conditions.push(`u.status = $${paramIndex}`);
    params.push(status.toUpperCase());
    paramIndex++;
  }

  if (relation && relation !== 'ALL') {
    if (relation === 'OWNER') {
      conditions.push(`EXISTS (SELECT 1 FROM tenant_owners tow WHERE tow.user_id = u.id)`);
    } else if (relation === 'MANAGER') {
      conditions.push(
        `EXISTS (SELECT 1 FROM store_staff ss WHERE ss.user_id = u.id AND ss.role = 'MANAGER')`
      );
    } else if (relation === 'STAFF') {
      conditions.push(
        `EXISTS (SELECT 1 FROM store_staff ss WHERE ss.user_id = u.id AND ss.role = 'STAFF')`
      );
    } else if (relation === 'UNASSIGNED') {
      conditions.push(
        `NOT EXISTS (SELECT 1 FROM tenant_owners tow WHERE tow.user_id = u.id) AND NOT EXISTS (SELECT 1 FROM store_staff ss WHERE ss.user_id = u.id)`
      );
    }
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  // Order
  let orderClause = 'ORDER BY u.created_at DESC';
  if (sort === 'oldest') orderClause = 'ORDER BY u.created_at ASC';
  if (sort === 'name_asc') orderClause = 'ORDER BY u.full_name ASC';
  if (sort === 'name_desc') orderClause = 'ORDER BY u.full_name DESC';

  const listSql = `
    SELECT 
      u.id,
      u.username,
      u.email,
      u.full_name,
      u.status,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      COALESCE(
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug))
         FROM tenant_owners tow
         JOIN tenants t ON t.id = tow.tenant_id
         WHERE tow.user_id = u.id),
        '[]'::json
      ) AS owned_tenants,
      COALESCE(
        (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'role', ss.role, 'tenant_name', t.name))
         FROM store_staff ss
         JOIN stores s ON s.id = ss.store_id
         LEFT JOIN tenants t ON t.id = s.tenant_id
         WHERE ss.user_id = u.id),
        '[]'::json
      ) AS staff_stores
    FROM app_users u
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countSql = `
    SELECT count(*)::int AS total
    FROM app_users u
    ${whereClause}
  `;

  const breakdownSql = `
    SELECT 
      count(*)::int AS all_count,
      count(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
      count(*) FILTER (WHERE status = 'INACTIVE')::int AS inactive_count
    FROM app_users
    WHERE deleted_at IS NULL
  `;

  const [listResult, countResult, breakdownResult] = await Promise.all([
    query(listSql, [...params, parsedLimit, offset]),
    query(countSql, params),
    query(breakdownSql),
  ]);

  const total = countResult.rows[0]?.total || 0;
  const breakdown = breakdownResult.rows[0] || { all_count: 0, active_count: 0, inactive_count: 0 };

  // Calculate formatted roles for UI
  const accounts = listResult.rows.map((user) => {
    const isOwner = user.owned_tenants && user.owned_tenants.length > 0;
    const staffRoles = (user.staff_stores || []).map((s) => s.role);
    const hasManager = staffRoles.includes('MANAGER');
    const hasStaff = staffRoles.includes('STAFF');

    let primaryRole = 'UNASSIGNED';
    let roleLabel = 'Chưa phân quyền';

    if (isOwner && hasManager) {
      primaryRole = 'OWNER_MANAGER';
      roleLabel = 'Owner + Manager';
    } else if (isOwner) {
      primaryRole = 'OWNER';
      roleLabel = 'Owner';
    } else if (hasManager) {
      primaryRole = 'MANAGER';
      roleLabel = 'Manager';
    } else if (hasStaff) {
      primaryRole = 'STAFF';
      roleLabel = 'Staff';
    }

    return {
      ...user,
      is_owner: isOwner,
      primary_role: primaryRole,
      role_label: roleLabel,
      owned_tenants_count: user.owned_tenants.length,
      stores_count: user.staff_stores.length,
    };
  });

  return {
    accounts,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    counts: breakdown,
  };
}

export async function getAccountById(userId) {
  const result = await query(
    `SELECT 
      u.id,
      u.username,
      u.email,
      u.full_name,
      u.status,
      u.last_login_at,
      u.created_at,
      u.updated_at,
      COALESCE(
        (SELECT json_agg(json_build_object('id', t.id, 'name', t.name, 'slug', t.slug, 'joined_at', tow.joined_at))
         FROM tenant_owners tow
         JOIN tenants t ON t.id = tow.tenant_id
         WHERE tow.user_id = u.id),
        '[]'::json
      ) AS owned_tenants,
      COALESCE(
        (SELECT json_agg(json_build_object('id', s.id, 'name', s.name, 'role', ss.role, 'tenant_name', t.name, 'joined_at', ss.joined_at))
         FROM store_staff ss
         JOIN stores s ON s.id = ss.store_id
         LEFT JOIN tenants t ON t.id = s.tenant_id
         WHERE ss.user_id = u.id),
        '[]'::json
      ) AS staff_stores
    FROM app_users u
    WHERE u.id = $1 AND u.deleted_at IS NULL`,
    [userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, 'Không tìm thấy tài khoản.');
  }

  const isOwner = user.owned_tenants && user.owned_tenants.length > 0;
  const staffRoles = (user.staff_stores || []).map((s) => s.role);
  const hasManager = staffRoles.includes('MANAGER');
  const hasStaff = staffRoles.includes('STAFF');

  let primaryRole = 'UNASSIGNED';
  let roleLabel = 'Chưa phân quyền';

  if (isOwner && hasManager) {
    primaryRole = 'OWNER_MANAGER';
    roleLabel = 'Owner + Manager';
  } else if (isOwner) {
    primaryRole = 'OWNER';
    roleLabel = 'Owner';
  } else if (hasManager) {
    primaryRole = 'MANAGER';
    roleLabel = 'Manager';
  } else if (hasStaff) {
    primaryRole = 'STAFF';
    roleLabel = 'Staff';
  }

  return {
    ...user,
    is_owner: isOwner,
    primary_role: primaryRole,
    role_label: roleLabel,
  };
}

export async function createAccount({ username, email, full_name, password, status = 'ACTIVE' }, adminId) {
  const trimmedUsername = typeof username === 'string' ? username.trim().toLowerCase() : '';
  const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const trimmedFullName = typeof full_name === 'string' ? full_name.trim() : '';

  if (!trimmedUsername) {
    throw new ApiError(400, 'Tên đăng nhập là bắt buộc.');
  }
  if (!trimmedEmail) {
    throw new ApiError(400, 'Email là bắt buộc.');
  }
  if (!password || password.length < 6) {
    throw new ApiError(400, 'Mật khẩu khởi tạo phải từ 6 ký tự trở lên.');
  }

  // Check duplicate
  const dupCheck = await query(
    `SELECT 1 FROM app_users WHERE (lower(username) = $1 OR lower(email) = $2) AND deleted_at IS NULL LIMIT 1`,
    [trimmedUsername, trimmedEmail]
  );

  if (dupCheck.rows.length > 0) {
    throw new ApiError(409, 'Tên đăng nhập hoặc Email này đã tồn tại trong hệ thống.');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const statusValue = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const insertRes = await query(
    `INSERT INTO app_users (username, email, password_hash, full_name, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())
     RETURNING id, username, email, full_name, status, created_at, updated_at`,
    [trimmedUsername, trimmedEmail, passwordHash, trimmedFullName || trimmedUsername, statusValue]
  );

  const newUser = insertRes.rows[0];

  await logAdminAction({
    adminId,
    action: 'CREATE_USER_ACCOUNT',
    targetType: 'USER',
    targetId: newUser.id,
    details: { username: newUser.username, email: newUser.email, status: statusValue },
  });

  return {
    ...newUser,
    is_owner: false,
    primary_role: 'UNASSIGNED',
    role_label: 'Chưa phân quyền',
    owned_tenants: [],
    staff_stores: [],
  };
}

export async function updateAccount(userId, { full_name, email, username, status }, adminId) {
  const existingRes = await query(`SELECT * FROM app_users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
  const existing = existingRes.rows[0];
  if (!existing) {
    throw new ApiError(404, 'Tài khoản không tồn tại.');
  }

  const updatedFullName = full_name !== undefined ? full_name.trim() : existing.full_name;
  const updatedEmail = email !== undefined ? email.trim().toLowerCase() : existing.email;
  const updatedUsername = username !== undefined ? username.trim().toLowerCase() : existing.username;
  const updatedStatus = status !== undefined ? (status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : existing.status;

  // Check duplicate if email or username changed
  if (updatedEmail !== existing.email || updatedUsername !== existing.username) {
    const dupCheck = await query(
      `SELECT 1 FROM app_users WHERE (lower(username) = $1 OR lower(email) = $2) AND id <> $3 AND deleted_at IS NULL LIMIT 1`,
      [updatedUsername, updatedEmail, userId]
    );
    if (dupCheck.rows.length > 0) {
      throw new ApiError(409, 'Tên đăng nhập hoặc Email đã được sử dụng bởi tài khoản khác.');
    }
  }

  const result = await query(
    `UPDATE app_users
     SET full_name = $1, email = $2, username = $3, status = $4, updated_at = now()
     WHERE id = $5 AND deleted_at IS NULL
     RETURNING id, username, email, full_name, status, created_at, updated_at`,
    [updatedFullName, updatedEmail, updatedUsername, updatedStatus, userId]
  );

  await logAdminAction({
    adminId,
    action: 'UPDATE_USER_ACCOUNT',
    targetType: 'USER',
    targetId: userId,
    details: { username: updatedUsername, email: updatedEmail, status: updatedStatus },
  });

  return result.rows[0];
}

export async function toggleAccountStatus(userId, status, reason, adminId) {
  const statusValue = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const result = await query(
    `UPDATE app_users
     SET status = $1, updated_at = now()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING id, username, email, full_name, status, updated_at`,
    [statusValue, userId]
  );

  const updated = result.rows[0];
  if (!updated) {
    throw new ApiError(404, 'Không tìm thấy tài khoản.');
  }

  await logAdminAction({
    adminId,
    action: statusValue === 'ACTIVE' ? 'ACTIVATE_USER_ACCOUNT' : 'DEACTIVATE_USER_ACCOUNT',
    targetType: 'USER',
    targetId: userId,
    details: { username: updated.username, status: statusValue, reason: reason || null },
  });

  return updated;
}

export async function resetAccountPassword(userId, newPassword, adminId) {
  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'Mật khẩu mới phải từ 6 ký tự trở lên.');
  }

  const existingRes = await query(`SELECT id, username FROM app_users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
  if (!existingRes.rows[0]) {
    throw new ApiError(404, 'Không tìm thấy tài khoản.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await query(
    `UPDATE app_users
     SET password_hash = $1, updated_at = now()
     WHERE id = $2 AND deleted_at IS NULL`,
    [passwordHash, userId]
  );

  await logAdminAction({
    adminId,
    action: 'RESET_USER_PASSWORD',
    targetType: 'USER',
    targetId: userId,
    details: { username: existingRes.rows[0].username },
  });

  return { success: true };
}

export default {
  listAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  toggleAccountStatus,
  resetAccountPassword,
};
