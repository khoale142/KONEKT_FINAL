import { ApiError } from '../utils/ApiError.js';

export function requireAdminRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.admin) {
      return next(new ApiError(401, 'Yêu cầu đăng nhập quản trị.'));
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    // SUPER_ADMIN has access to all admin operations
    if (req.admin.role === 'SUPER_ADMIN') {
      return next();
    }

    if (roles.length > 0 && !roles.includes(req.admin.role)) {
      return next(new ApiError(403, 'Bạn không có quyền thực hiện tác vụ này.'));
    }

    next();
  };
}

export default requireAdminRole;
