import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAdminAction } from '../../utils/adminAudit.js';

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function getStoreById(storeId) {
  const storeRes = await query(
    `SELECT 
      s.id, 
      s.tenant_id, 
      s.name, 
      s.address, 
      s.invite_code, 
      s.status, 
      s.created_at, 
      s.updated_at,
      t.name AS tenant_name,
      t.slug AS tenant_slug,
      t.status AS tenant_status
    FROM stores s
    LEFT JOIN tenants t ON t.id = s.tenant_id
    WHERE s.id = $1`,
    [storeId]
  );

  const store = storeRes.rows[0];
  if (!store) {
    throw new ApiError(404, 'Không tìm thấy thông tin cửa hàng.');
  }

  // Get staff list
  const staffRes = await query(
    `SELECT 
      u.id, 
      u.username, 
      u.email, 
      u.full_name, 
      u.status AS user_status, 
      ss.role, 
      ss.joined_at
    FROM store_staff ss
    JOIN app_users u ON u.id = ss.user_id
    WHERE ss.store_id = $1 AND u.deleted_at IS NULL
    ORDER BY ss.joined_at DESC, u.full_name ASC`,
    [storeId]
  );

  const staff = staffRes.rows.map((row) => ({
    ...row,
    role: (row.role || 'STAFF').toUpperCase(),
  }));

  const managerCount = staff.filter((s) => s.role === 'MANAGER').length;
  const regularStaffCount = staff.filter((s) => s.role === 'STAFF').length;

  return {
    ...store,
    staff,
    stats: {
      total_staff: staff.length,
      manager_count: managerCount,
      staff_count: regularStaffCount,
    },
  };
}

export async function updateStore(storeId, { name, address }, adminId) {
  const existingRes = await query(`SELECT * FROM stores WHERE id = $1`, [storeId]);
  const existing = existingRes.rows[0];
  if (!existing) {
    throw new ApiError(404, 'Cửa hàng không tồn tại.');
  }

  const updatedName = typeof name === 'string' && name.trim() ? name.trim() : existing.name;
  const updatedAddress = address !== undefined ? (typeof address === 'string' ? address.trim() : null) : existing.address;

  const result = await query(
    `UPDATE stores
     SET name = $1, address = $2, updated_at = now()
     WHERE id = $3
     RETURNING id, tenant_id, name, address, invite_code, status, created_at, updated_at`,
    [updatedName, updatedAddress, storeId]
  );

  await logAdminAction({
    adminId,
    action: 'UPDATE_STORE',
    targetType: 'STORE',
    targetId: storeId,
    details: { name: updatedName, changes: { name, address } },
  });

  return result.rows[0];
}

export async function toggleStoreStatus(storeId, nextStatus, adminId) {
  const statusValue = nextStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const result = await query(
    `UPDATE stores
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, tenant_id, name, status, updated_at`,
    [statusValue, storeId]
  );

  const updated = result.rows[0];
  if (!updated) {
    throw new ApiError(404, 'Không tìm thấy cửa hàng.');
  }

  await logAdminAction({
    adminId,
    action: statusValue === 'ACTIVE' ? 'ACTIVATE_STORE' : 'DEACTIVATE_STORE',
    targetType: 'STORE',
    targetId: storeId,
    details: { name: updated.name, status: statusValue },
  });

  return updated;
}

export async function regenerateInviteCode(storeId, adminId) {
  const checkStore = await query(`SELECT id, name FROM stores WHERE id = $1`, [storeId]);
  if (!checkStore.rows[0]) {
    throw new ApiError(404, 'Không tìm thấy cửa hàng.');
  }

  let inviteCode = generateInviteCode();
  let codeIsUnique = false;

  while (!codeIsUnique) {
    const checkResult = await query(`SELECT 1 FROM stores WHERE invite_code = $1 AND id <> $2`, [inviteCode, storeId]);
    if (checkResult.rows.length === 0) {
      codeIsUnique = true;
    } else {
      inviteCode = generateInviteCode();
    }
  }

  const result = await query(
    `UPDATE stores
     SET invite_code = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, invite_code, updated_at`,
    [inviteCode, storeId]
  );

  await logAdminAction({
    adminId,
    action: 'REGENERATE_STORE_INVITE_CODE',
    targetType: 'STORE',
    targetId: storeId,
    details: { invite_code: inviteCode },
  });

  return result.rows[0];
}

export async function addStoreMember(storeId, { email, username, userId, role = 'STAFF' }, adminId) {
  let targetUser = null;
  if (userId) {
    const uRes = await query(`SELECT id, username, email, full_name, status FROM app_users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
    targetUser = uRes.rows[0];
  } else if (email) {
    const uRes = await query(`SELECT id, username, email, full_name, status FROM app_users WHERE lower(email) = lower($1) AND deleted_at IS NULL`, [email.trim()]);
    targetUser = uRes.rows[0];
  } else if (username) {
    const uRes = await query(`SELECT id, username, email, full_name, status FROM app_users WHERE lower(username) = lower($1) AND deleted_at IS NULL`, [username.trim()]);
    targetUser = uRes.rows[0];
  }

  if (!targetUser) {
    throw new ApiError(404, 'Không tìm thấy tài khoản người dùng tương ứng.');
  }

  const roleValue = role === 'MANAGER' ? 'MANAGER' : 'STAFF';

  // Insert or update store_staff
  await query(
    `INSERT INTO store_staff (user_id, store_id, role, joined_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (user_id, store_id) DO UPDATE SET role = EXCLUDED.role`,
    [targetUser.id, storeId, roleValue]
  );

  await logAdminAction({
    adminId,
    action: 'ADD_STORE_MEMBER',
    targetType: 'STORE',
    targetId: storeId,
    details: { userId: targetUser.id, username: targetUser.username, role: roleValue },
  });

  return {
    ...targetUser,
    role: roleValue,
    joined_at: new Date().toISOString(),
  };
}

export async function updateStoreMemberRole(storeId, userId, role, adminId) {
  const roleValue = role === 'MANAGER' ? 'MANAGER' : 'STAFF';

  const result = await query(
    `UPDATE store_staff
     SET role = $1
     WHERE store_id = $2 AND user_id = $3
     RETURNING user_id, store_id, role`,
    [roleValue, storeId, userId]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, 'Không tìm thấy thành viên trong cửa hàng này.');
  }

  await logAdminAction({
    adminId,
    action: 'UPDATE_STORE_MEMBER_ROLE',
    targetType: 'STORE',
    targetId: storeId,
    details: { userId, role: roleValue },
  });

  return result.rows[0];
}

export async function removeStoreMember(storeId, userId, adminId) {
  const result = await query(
    `DELETE FROM store_staff WHERE store_id = $1 AND user_id = $2 RETURNING user_id`,
    [storeId, userId]
  );

  if (!result.rows[0]) {
    throw new ApiError(404, 'Thành viên không thuộc cửa hàng này.');
  }

  await logAdminAction({
    adminId,
    action: 'REMOVE_STORE_MEMBER',
    targetType: 'STORE',
    targetId: storeId,
    details: { userId },
  });

  return { success: true };
}

export default {
  getStoreById,
  updateStore,
  toggleStoreStatus,
  regenerateInviteCode,
  addStoreMember,
  updateStoreMemberRole,
  removeStoreMember,
};
