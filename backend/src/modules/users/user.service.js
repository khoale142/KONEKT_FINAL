import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { toPublicUser } from '../../utils/user.js';

const USER_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function ensureValidPassword(password) {
  if (!password) {
    throw new ApiError(400, 'Password is required.');
  }

  if (password.length < 6 || password.length > 63) {
    throw new ApiError(400, 'Password must be between 6 and 63 characters.');
  }
}

async function findUserRowById(userId) {
  const result = await query(
    `select id, username, email, full_name, status, last_login_at, created_at, updated_at
     from app_users
     where id = $1 and deleted_at is null
     limit 1`,
    [userId],
  );

  return result.rows[0] || null;
}

export async function listStoreStaff(storeId, { search = '', status }) {
  const params = [storeId];
  const conditions = ['u.deleted_at is null', 'ss.store_id = $1'];

  const normalizedSearch = normalizeString(search);
  const normalizedStatus = normalizeString(status).toUpperCase();

  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    conditions.push(
      `(u.username ilike $${params.length} or u.full_name ilike $${params.length} or u.email ilike $${params.length})`,
    );
  }

  if (normalizedStatus && normalizedStatus !== 'ALL') {
    if (![USER_STATUSES.ACTIVE, USER_STATUSES.INACTIVE].includes(normalizedStatus)) {
      throw new ApiError(400, 'Status is invalid.');
    }
    params.push(normalizedStatus);
    conditions.push(`u.status = $${params.length}`);
  }

  const result = await query(
    `select u.id, u.username, u.email, u.full_name, u.status, u.last_login_at, u.created_at, u.updated_at
     from app_users u
     join store_staff ss on u.id = ss.staff_id
     where ${conditions.join(' and ')}
     order by u.full_name asc`,
    params,
  );

  return result.rows.map(toPublicUser);
}

export async function getUserById(userId) {
  const user = await findUserRowById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return toPublicUser(user);
}

export async function removeStaffFromStore(staffId, storeId) {
  const result = await query(
    `delete from store_staff
     where staff_id = $1 and store_id = $2
     returning staff_id`,
    [staffId, storeId]
  );
  
  if (result.rows.length === 0) {
    throw new ApiError(404, 'Staff not found in this store.');
  }
}

export async function resetUserPassword(userId, payload) {
  const existingUser = await findUserRowById(userId);

  if (!existingUser) {
    throw new ApiError(404, 'User not found.');
  }

  const newPassword = payload.newPassword;
  ensureValidPassword(newPassword);

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await query(
    `update app_users
     set password_hash = $1,
         updated_at = now()
     where id = $2 and deleted_at is null`,
    [newPasswordHash, userId],
  );

  return toPublicUser(existingUser);
}
