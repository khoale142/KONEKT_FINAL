import { sendSuccess } from '../../utils/apiResponse.js';
import adminAuthService from './admin_auth.service.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    const result = await adminAuthService.loginAdmin({
      email,
      password,
      ipAddress,
      userAgent,
    });

    return sendSuccess(res, {
      message: 'Đăng nhập trang quản trị thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMe(req, res, next) {
  try {
    const adminUser = await adminAuthService.getAdminProfile(req.admin.id);
    return sendSuccess(res, {
      message: 'Lấy thông tin quản trị viên thành công.',
      data: { user: adminUser },
    });
  } catch (error) {
    next(error);
  }
}

export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    const result = await adminAuthService.requestAdminPasswordReset({ email });
    return sendSuccess(res, {
      message: 'Mã xác minh đặt lại mật khẩu đã được gửi.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const { email, token, newPassword } = req.body;
    const result = await adminAuthService.resetAdminPasswordWithToken({
      email,
      token,
      newPassword,
    });
    return sendSuccess(res, {
      message: 'Mật khẩu quản trị đã được đặt lại thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function logout(req, res) {
  return sendSuccess(res, {
    message: 'Đăng xuất khỏi trang quản trị thành công.',
    data: { success: true },
  });
}

export async function updateProfile(req, res, next) {
  try {
    const { fullName, email } = req.body;
    const updatedUser = await adminAuthService.updateAdminProfile(req.admin.id, { fullName, email });
    return sendSuccess(res, {
      message: 'Cập nhật thông tin hồ sơ thành công.',
      data: { user: updatedUser },
    });
  } catch (error) {
    next(error);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await adminAuthService.changeAdminPassword(req.admin.id, { currentPassword, newPassword });
    return sendSuccess(res, {
      message: 'Đổi mật khẩu thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getSecurityDetails(req, res, next) {
  try {
    const data = await adminAuthService.getAdminSecurityDetails(req.admin.id);
    return sendSuccess(res, {
      message: 'Lấy thông tin bảo mật thành công.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  login,
  getMe,
  updateProfile,
  changePassword,
  getSecurityDetails,
  forgotPassword,
  resetPassword,
  logout,
};
