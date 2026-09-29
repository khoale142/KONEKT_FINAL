import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/jwt.js';

export async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'Yêu cầu quyền truy cập quản trị. Vui lòng đăng nhập.');
    }

    const payload = verifyAccessToken(token);

    if (!payload.adminId && !payload.userId) {
      throw new ApiError(401, 'Mã phiên quản trị không hợp lệ.');
    }

    const targetId = payload.adminId || payload.userId;

    const result = await query(
      `SELECT id, username, email, full_name, status, last_login_at, created_at, updated_at
       FROM app_users
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [targetId]
    );

    const user = result.rows[0];

    if (!user || user.status !== 'ACTIVE') {
      throw new ApiError(401, 'Tài khoản quản trị viên không khả dụng hoặc bị khóa.');
    }

    req.admin = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: payload.role || 'SUPER_ADMIN',
      status: user.status,
    };

    next();
  } catch (error) {
    next(error.statusCode ? error : new ApiError(401, 'Phiên đăng nhập quản trị đã hết hạn.'));
  }
}

export default requireAdminAuth;
