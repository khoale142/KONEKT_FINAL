import bcrypt from 'bcryptjs';
import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { signAccessToken } from '../../utils/jwt.js';
import { toPublicUser } from '../../utils/user.js';
import { mailSender } from '../../config/mail.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase();
}

function validateEmail(email) {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email);
}

function validatePasswordValue(password) {
  if (!password) {
    throw new ApiError(400, 'Password is required.');
  }

  if (password.length < 6 || password.length > 63) {
    throw new ApiError(400, 'Password must be between 6 and 63 characters.');
  }
}

async function getUserAuthRowById(userId) {
  const result = await query(
    `select id, username, email, full_name, password_hash, role, status, last_login_at, created_at, updated_at
     from app_users
     where id = $1 and deleted_at is null
     limit 1`,
    [userId],
  );

  return result.rows[0] || null;
}

export async function loginWithEmailPassword({ email, password }) {
  if (!email || !password) {
    throw new ApiError(400, 'Email and password are required.');
  }

  const normalizedEmail = normalizeEmail(email);

  const result = await query(
    `select id, username, email, password_hash, full_name, role, status, last_login_at, created_at, updated_at
     from app_users
     where lower(email) = lower($1) and deleted_at is null
     limit 1`,
    [normalizedEmail],
  );

  const user = result.rows[0];

  if (!user) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'This account is inactive.');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid username or password.');
  }

  const updateResult = await query(
    `update app_users
     set last_login_at = now(), updated_at = now()
     where id = $1
     returning last_login_at, updated_at`,
    [user.id],
  );

  const publicUser = toPublicUser({
    ...user,
    last_login_at: updateResult.rows[0]?.last_login_at || user.last_login_at,
    updated_at: updateResult.rows[0]?.updated_at || user.updated_at,
  });
  const token = signAccessToken(publicUser);

  return { user: publicUser, token };
}

export async function registerUser({ username, email, password, fullName }) {
  const normalizedUsername = normalizeString(username);
  const normalizedEmail = normalizeEmail(email);
  const normalizedFullName = normalizeString(fullName);

  if (!normalizedUsername) {
    throw new ApiError(400, 'Username is required.');
  }

  if (normalizedUsername.length > 50) {
    throw new ApiError(400, 'Username must not exceed 50 characters.');
  }

  if (!normalizedEmail) {
    throw new ApiError(400, 'Email is required.');
  }

  if (!validateEmail(normalizedEmail)) {
    throw new ApiError(400, 'Email format is invalid.');
  }

  if (!normalizedFullName) {
    throw new ApiError(400, 'Full name is required.');
  }

  validatePasswordValue(password);

  const duplicateCheck = await query(
    `select 1 from app_users where (lower(username) = lower($1) or lower(email) = lower($2)) and deleted_at is null limit 1`,
    [normalizedUsername, normalizedEmail]
  );

  if (duplicateCheck.rows[0]) {
    throw new ApiError(409, 'Username or Email already exists.');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await query(
    `insert into app_users (username, email, password_hash, full_name, status)
     values ($1, $2, $3, $4, 'ACTIVE')
     returning id, username, email, full_name, status, last_login_at, created_at, updated_at`,
    [normalizedUsername, normalizedEmail, passwordHash, normalizedFullName]
  );

  const user = result.rows[0];
  const publicUser = toPublicUser(user);
  const token = signAccessToken(publicUser);

  return { user: publicUser, token };
}

export async function updateCurrentUserProfile(userId, { fullName, email }) {
  const normalizedFullName = normalizeString(fullName);
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedFullName) {
    throw new ApiError(400, 'Full name is required.');
  }

  if (normalizedFullName.length > 120) {
    throw new ApiError(400, 'Full name must not exceed 120 characters.');
  }

  if (!normalizedEmail) {
    throw new ApiError(400, 'Email is required.');
  }

  if (normalizedEmail.length > 120) {
    throw new ApiError(400, 'Email must not exceed 120 characters.');
  }

  if (!validateEmail(normalizedEmail)) {
    throw new ApiError(400, 'Email format is invalid.');
  }

  const duplicateEmailResult = await query(
    `select id
     from app_users
     where lower(email) = lower($1)
       and id <> $2
       and deleted_at is null
     limit 1`,
    [normalizedEmail, userId],
  );

  if (duplicateEmailResult.rows[0]) {
    throw new ApiError(409, 'Email already exists.');
  }

  const result = await query(
    `update app_users
     set full_name = $1,
         email = $2,
         updated_at = now()
     where id = $3 and deleted_at is null
     returning id, username, email, full_name, role, status, last_login_at, created_at, updated_at`,
    [normalizedFullName, normalizedEmail, userId],
  );

  const user = result.rows[0];

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  return toPublicUser(user);
}

export async function changeCurrentUserPassword(userId, { currentPassword, newPassword }) {
  if (!currentPassword) {
    throw new ApiError(400, 'Current password is required.');
  }

  validatePasswordValue(newPassword);

  if (currentPassword === newPassword) {
    throw new ApiError(400, 'New password must be different from the current password.');
  }

  const user = await getUserAuthRowById(userId);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'This account is inactive.');
  }

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);

  if (!isCurrentPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await query(
    `update app_users
     set password_hash = $1,
         updated_at = now()
     where id = $2`,
    [newPasswordHash, userId],
  );

  return { success: true };
}

export async function requestPasswordReset({ email, username }) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedUsername = typeof username === 'string' ? username.trim() : '';

  if (!normalizedEmail) {
    throw new ApiError(400, 'Email is required.');
  }

  if (!validateEmail(normalizedEmail)) {
    throw new ApiError(400, 'Email format is invalid.');
  }

  if (!trimmedUsername) {
    throw new ApiError(400, 'Username is required.');
  }

  const result = await query(
    `select id, username, status
     from app_users
     where lower(email) = lower($1) and deleted_at is null
     limit 1`,
    [normalizedEmail]
  );

  const user = result.rows[0];

  if (!user || user.username.toLowerCase() !== trimmedUsername.toLowerCase()) {
    throw new ApiError(404, 'No account found with this username and email combination.');
  }

  if (user.status !== 'ACTIVE') {
    throw new ApiError(403, 'This account is inactive.');
  }

  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const resetExpiresMinutes = parseInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '15', 10);
  const tokenExpiresAt = new Date(Date.now() + resetExpiresMinutes * 60 * 1000);

  await query(
    `update app_users
     set reset_token = $1,
         reset_token_expires_at = $2,
         updated_at = now()
     where id = $3`,
    [resetCode, tokenExpiresAt, user.id]
  );

  const brandName = process.env.MAIL_FROM_NAME || 'Mini Coffee POS';
  const subject = `[${brandName}] Mã xác nhận đặt lại mật khẩu`;
  const text = `Xin chào ${user.username},\n\nMã xác nhận để đặt lại mật khẩu của bạn là: ${resetCode}\nMã này có hiệu lực trong vòng ${resetExpiresMinutes} phút.\n\nNếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.`;

  // Send email asynchronously in the background to avoid blocking the API response (saves 5-7s)
  mailSender.sendEmail({
    to: normalizedEmail,
    subject,
    text,
  }).catch((error) => {
    console.error(`[mail] Failed to send password reset email to ${normalizedEmail}:`, error.message || error);
  });

  return { success: true };
}

export async function resetPasswordWithToken({ email, token, newPassword }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedToken = typeof token === 'string' ? token.trim() : '';

  if (!normalizedEmail || !normalizedToken) {
    throw new ApiError(400, 'Email and verification code are required.');
  }

  validatePasswordValue(newPassword);

  const result = await query(
    `select id, reset_token, reset_token_expires_at
     from app_users
     where lower(email) = lower($1) and deleted_at is null
     limit 1`,
    [normalizedEmail]
  );

  const user = result.rows[0];

  if (!user) {
    throw new ApiError(404, 'No account found with this email.');
  }

  if (!user.reset_token || user.reset_token !== normalizedToken) {
    throw new ApiError(400, 'Invalid verification code.');
  }

  const expiresAt = new Date(user.reset_token_expires_at);
  if (expiresAt < new Date()) {
    throw new ApiError(400, 'Verification code has expired.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await query(
    `update app_users
     set password_hash = $1,
         reset_token = null,
         reset_token_expires_at = null,
         updated_at = now()
     where id = $2`,
    [newPasswordHash, user.id]
  );

  return { success: true };
}
