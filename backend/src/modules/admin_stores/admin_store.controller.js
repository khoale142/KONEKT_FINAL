import { sendSuccess } from '../../utils/apiResponse.js';
import adminStoreService from './admin_store.service.js';

export async function getStore(req, res, next) {
  try {
    const { id } = req.params;
    const store = await adminStoreService.getStoreById(id);
    return sendSuccess(res, {
      message: 'Lấy thông tin cửa hàng thành công.',
      data: store,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStore(req, res, next) {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    const updatedStore = await adminStoreService.updateStore(id, { name, address }, req.admin.id);
    return sendSuccess(res, {
      message: 'Cập nhật thông tin cửa hàng thành công.',
      data: updatedStore,
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleStoreStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedStore = await adminStoreService.toggleStoreStatus(id, status, req.admin.id);
    return sendSuccess(res, {
      message: status === 'ACTIVE' ? 'Kích hoạt cửa hàng thành công.' : 'Vô hiệu hóa cửa hàng thành công.',
      data: updatedStore,
    });
  } catch (error) {
    next(error);
  }
}

export async function regenerateInviteCode(req, res, next) {
  try {
    const { id } = req.params;
    const result = await adminStoreService.regenerateInviteCode(id, req.admin.id);
    return sendSuccess(res, {
      message: 'Đặt lại mã mời thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function addStoreMember(req, res, next) {
  try {
    const { id } = req.params;
    const { email, username, userId, role } = req.body;
    const member = await adminStoreService.addStoreMember(id, { email, username, userId, role }, req.admin.id);
    return sendSuccess(res, {
      message: 'Thêm thành viên vào cửa hàng thành công.',
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStoreMemberRole(req, res, next) {
  try {
    const { id, userId } = req.params;
    const { role } = req.body;
    const updated = await adminStoreService.updateStoreMemberRole(id, userId, role, req.admin.id);
    return sendSuccess(res, {
      message: 'Cập nhật vai trò thành viên thành công.',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeStoreMember(req, res, next) {
  try {
    const { id, userId } = req.params;
    const result = await adminStoreService.removeStoreMember(id, userId, req.admin.id);
    return sendSuccess(res, {
      message: 'Gỡ thành viên khỏi cửa hàng thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getStore,
  updateStore,
  toggleStoreStatus,
  regenerateInviteCode,
  addStoreMember,
  updateStoreMemberRole,
  removeStoreMember,
};
