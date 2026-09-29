import { sendSuccess } from '../../utils/apiResponse.js';
import adminInternalStaffService from './admin_internal_staff.service.js';

export async function getStaffList(req, res, next) {
  try {
    const { search, status, role, sort, page, limit } = req.query;
    const result = await adminInternalStaffService.listInternalStaff({
      search,
      status,
      role,
      sort,
      page,
      limit,
    });
    return sendSuccess(res, {
      message: 'Lấy danh sách nhân sự nội bộ thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStaffDetail(req, res, next) {
  try {
    const { id } = req.params;
    const staff = await adminInternalStaffService.getInternalStaffById(id);
    return sendSuccess(res, {
      message: 'Lấy thông tin nhân sự nội bộ thành công.',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
}

export async function addStaff(req, res, next) {
  try {
    const staff = await adminInternalStaffService.addInternalStaff(req.body, req.admin.id);
    return sendSuccess(res, {
      message: 'Thêm nhân sự nội bộ thành công.',
      data: staff,
      statusCode: 201,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStaffRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body;
    const staff = await adminInternalStaffService.updateInternalStaffRole(id, role, req.admin.id);
    return sendSuccess(res, {
      message: 'Cập nhật vai trò nhân sự thành công.',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleStaffStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const staff = await adminInternalStaffService.toggleInternalStaffStatus(id, status, reason, req.admin.id);
    return sendSuccess(res, {
      message: status === 'ACTIVE' ? 'Kích hoạt nhân sự thành công.' : 'Vô hiệu hóa nhân sự thành công.',
      data: staff,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetStaffPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await adminInternalStaffService.resetInternalStaffPassword(id, newPassword, req.admin.id);
    return sendSuccess(res, {
      message: 'Đặt lại mật khẩu nhân sự thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getStaffList,
  getStaffDetail,
  addStaff,
  updateStaffRole,
  toggleStaffStatus,
  resetStaffPassword,
};
