import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAdminAction } from '../../utils/adminAudit.js';

let isTableInitialized = false;

export async function ensureInternalAdminsTable() {
  if (isTableInitialized) return;

  await query(`
    CREATE TABLE IF NOT EXISTS internal_admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES app_users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'ADMIN',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Ensure initial admin user is added if table is empty
  const countRes = await query(`SELECT count(*)::int AS count FROM internal_admins`);
  if ((countRes.rows[0]?.count || 0) === 0) {
    const adminUser = await query(`SELECT id FROM app_users WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 3`);
    if (adminUser.rows.length > 0) {
      for (let i = 0; i < adminUser.rows.length; i++) {
        const u = adminUser.rows[i];
        const role = i === 0 ? 'SUPER_ADMIN' : i === 1 ? 'ADMIN' : 'SUPPORT';
        await query(
          `INSERT INTO internal_admins (user_id, role, created_at, updated_at)
           VALUES ($1, $2, now(), now())
           ON CONFLICT (user_id) DO NOTHING`,
          [u.id, role]
        );
      }
    }
  }

  isTableInitialized = true;
}

export async function listInternalStaff({
  search = '',
  status = 'ALL',
  role = 'ALL',
  sort = 'newest',
  page = 1,
  limit = 10,
}) {
  await ensureInternalAdminsTable();

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const parsedLimit = parseInt(limit, 10);

  const conditions = ['u.deleted_at IS NULL'];
  const params = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    const q = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      `(lower(u.full_name) LIKE $${paramIndex} OR lower(u.username) LIKE $${paramIndex} OR lower(u.email) LIKE $${paramIndex} OR lower(ia.id::text) LIKE $${paramIndex})`
    );
    params.push(q);
    paramIndex++;
  }

  if (status && status !== 'ALL') {
    conditions.push(`u.status = $${paramIndex}`);
    params.push(status.toUpperCase());
    paramIndex++;
  }

  if (role && role !== 'ALL') {
    conditions.push(`ia.role = $${paramIndex}`);
    params.push(role.toUpperCase());
    paramIndex++;
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  let orderClause = 'ORDER BY ia.created_at DESC';
  if (sort === 'oldest') orderClause = 'ORDER BY ia.created_at ASC';
  if (sort === 'name_asc') orderClause = 'ORDER BY u.full_name ASC';
  if (sort === 'name_desc') orderClause = 'ORDER BY u.full_name DESC';

  const listSql = `
    SELECT 
      ia.id,
      ia.user_id,
      ia.role,
      ia.created_at,
      ia.updated_at,
      u.username,
      u.email,
      u.full_name,
      u.status,
      u.last_login_at
    FROM internal_admins ia
    JOIN app_users u ON u.id = ia.user_id
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countSql = `
    SELECT count(*)::int AS total
    FROM internal_admins ia
    JOIN app_users u ON u.id = ia.user_id
    ${whereClause}
  `;

  const breakdownSql = `
    SELECT 
      count(*)::int AS all_count,
      count(*) FILTER (WHERE u.status = 'ACTIVE')::int AS active_count,
      count(*) FILTER (WHERE u.status = 'INACTIVE')::int AS inactive_count
    FROM internal_admins ia
    JOIN app_users u ON u.id = ia.user_id
    WHERE u.deleted_at IS NULL
  `;

  const [listResult, countResult, breakdownResult] = await Promise.all([
    query(listSql, [...params, parsedLimit, offset]),
    query(countSql, params),
    query(breakdownSql),
  ]);

  const total = countResult.rows[0]?.total || 0;
  const breakdown = breakdownResult.rows[0] || { all_count: 0, active_count: 0, inactive_count: 0 };

  return {
    staff: listResult.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    counts: breakdown,
  };
}

export async function getInternalStaffById(id) {
  await ensureInternalAdminsTable();

  const result = await query(
    `SELECT 
      ia.id,
      ia.user_id,
      ia.role,
      ia.created_at,
      ia.updated_at,
      u.username,
      u.email,
      u.full_name,
      u.status,
      u.last_login_at
    FROM internal_admins ia
    JOIN app_users u ON u.id = ia.user_id
    WHERE (ia.id = $1 OR ia.user_id = $1) AND u.deleted_at IS NULL`,
    [id]
  );

  const staff = result.rows[0];
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy thông tin nhân sự nội bộ.');
  }

  return staff;
}

export async function addInternalStaff(data, adminId) {
  await ensureInternalAdminsTable();

  const { email, username, userId, role = 'ADMIN', password, full_name, status = 'ACTIVE' } = data;
  const validRole = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(role) ? role : 'ADMIN';

  let targetUserId = userId;

  if (!targetUserId) {
    // Try to find by email or username
    if (email) {
      const uRes = await query(`SELECT id FROM app_users WHERE lower(email) = lower($1) AND deleted_at IS NULL`, [email.trim()]);
      targetUserId = uRes.rows[0]?.id;
    } else if (username) {
      const uRes = await query(`SELECT id FROM app_users WHERE lower(username) = lower($1) AND deleted_at IS NULL`, [username.trim()]);
      targetUserId = uRes.rows[0]?.id;
    }
  }

  // If user does not exist, create new app_user if password is provided
  if (!targetUserId) {
    if (!username || !email) {
      throw new ApiError(400, 'Vui lòng cung cấp thông tin tài khoản (Email, Username).');
    }
    const pwd = password || '123456';
    const pwdHash = await bcrypt.hash(pwd, 10);
    const createRes = await query(
      `INSERT INTO app_users (username, email, password_hash, full_name, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())
       RETURNING id`,
      [username.trim().toLowerCase(), email.trim().toLowerCase(), pwdHash, full_name ? full_name.trim() : username.trim(), status]
    );
    targetUserId = createRes.rows[0].id;
  }

  // Insert or update internal_admins
  const result = await query(
    `INSERT INTO internal_admins (user_id, role, created_at, updated_at)
     VALUES ($1, $2, now(), now())
     ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now()
     RETURNING id, user_id, role, created_at, updated_at`,
    [targetUserId, validRole]
  );

  const staff = await getInternalStaffById(result.rows[0].id);

  await logAdminAction({
    adminId,
    action: 'ADD_INTERNAL_STAFF',
    targetType: 'INTERNAL_STAFF',
    targetId: staff.id,
    details: { userId: targetUserId, role: validRole, email: staff.email },
  });

  return staff;
}

export async function updateInternalStaffRole(id, role, adminId) {
  await ensureInternalAdminsTable();

  const validRole = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'].includes(role) ? role : 'ADMIN';

  const result = await query(
    `UPDATE internal_admins
     SET role = $1, updated_at = now()
     WHERE (id = $2 OR user_id = $2)
     RETURNING id, user_id, role, updated_at`,
    [validRole, id]
  );

  const updated = result.rows[0];
  if (!updated) {
    throw new ApiError(404, 'Nhân sự nội bộ không tồn tại.');
  }

  const staff = await getInternalStaffById(updated.id);

  await logAdminAction({
    adminId,
    action: 'UPDATE_INTERNAL_STAFF_ROLE',
    targetType: 'INTERNAL_STAFF',
    targetId: staff.id,
    details: { role: validRole, username: staff.username },
  });

  return staff;
}

export async function toggleInternalStaffStatus(id, status, reason, adminId) {
  await ensureInternalAdminsTable();

  const statusValue = status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const staffRes = await query(
    `SELECT ia.id, ia.user_id, u.username, u.email
     FROM internal_admins ia
     JOIN app_users u ON u.id = ia.user_id
     WHERE ia.id = $1 OR ia.user_id = $1`,
    [id]
  );

  const staff = staffRes.rows[0];
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân sự nội bộ.');
  }

  await query(
    `UPDATE app_users
     SET status = $1, updated_at = now()
     WHERE id = $2`,
    [statusValue, staff.user_id]
  );

  await logAdminAction({
    adminId,
    action: statusValue === 'ACTIVE' ? 'ACTIVATE_INTERNAL_STAFF' : 'DEACTIVATE_INTERNAL_STAFF',
    targetType: 'INTERNAL_STAFF',
    targetId: staff.id,
    details: { username: staff.username, status: statusValue, reason: reason || null },
  });

  return getInternalStaffById(staff.id);
}

export async function resetInternalStaffPassword(id, newPassword, adminId) {
  await ensureInternalAdminsTable();

  if (!newPassword || newPassword.length < 6) {
    throw new ApiError(400, 'Mật khẩu mới phải từ 6 ký tự trở lên.');
  }

  const staffRes = await query(
    `SELECT ia.id, ia.user_id, u.username FROM internal_admins ia JOIN app_users u ON u.id = ia.user_id WHERE ia.id = $1 OR ia.user_id = $1`,
    [id]
  );

  const staff = staffRes.rows[0];
  if (!staff) {
    throw new ApiError(404, 'Không tìm thấy nhân sự.');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await query(
    `UPDATE app_users SET password_hash = $1, updated_at = now() WHERE id = $2`,
    [passwordHash, staff.user_id]
  );

  await logAdminAction({
    adminId,
    action: 'RESET_INTERNAL_STAFF_PASSWORD',
    targetType: 'INTERNAL_STAFF',
    targetId: staff.id,
    details: { username: staff.username },
  });

  return { success: true };
}

export default {
  listInternalStaff,
  getInternalStaffById,
  addInternalStaff,
  updateInternalStaffRole,
  toggleInternalStaffStatus,
  resetInternalStaffPassword,
};
