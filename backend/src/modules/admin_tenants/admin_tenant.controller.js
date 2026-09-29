import { sendSuccess } from '../../utils/apiResponse.js';
import adminTenantService from './admin_tenant.service.js';

export async function getTenants(req, res, next) {
  try {
    const { search, status, sort, page, limit } = req.query;
    const result = await adminTenantService.listTenants({
      search,
      status,
      sort,
      page,
      limit,
    });
    return sendSuccess(res, {
      message: 'Lấy danh sách tổ chức thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTenant(req, res, next) {
  try {
    const { id } = req.params;
    const tenant = await adminTenantService.getTenantById(id);
    return sendSuccess(res, {
      message: 'Lấy thông tin tổ chức thành công.',
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
}

export async function createTenant(req, res, next) {
  try {
    const { name, slug, email, phone, address, status } = req.body;
    const tenant = await adminTenantService.createTenant(
      { name, slug, email, phone, address, status },
      req.admin.id
    );
    return sendSuccess(res, {
      message: 'Tạo tổ chức mới thành công.',
      data: tenant,
      statusCode: 201,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTenant(req, res, next) {
  try {
    const { id } = req.params;
    const tenant = await adminTenantService.updateTenant(id, req.body, req.admin.id);
    return sendSuccess(res, {
      message: 'Cập nhật thông tin tổ chức thành công.',
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const tenant = await adminTenantService.toggleTenantStatus(id, status, req.admin.id);
    return sendSuccess(res, {
      message: status === 'ACTIVE' ? 'Kích hoạt tổ chức thành công.' : 'Vô hiệu hóa tổ chức thành công.',
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
}

export async function addOwner(req, res, next) {
  try {
    const { id } = req.params;
    const { email, username, userId } = req.body;
    const owner = await adminTenantService.addTenantOwner(id, { email, username, userId }, req.admin.id);
    return sendSuccess(res, {
      message: 'Thêm chủ sở hữu vào tổ chức thành công.',
      data: owner,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeOwner(req, res, next) {
  try {
    const { id, userId } = req.params;
    const result = await adminTenantService.removeTenantOwner(id, userId, req.admin.id);
    return sendSuccess(res, {
      message: 'Đã gỡ quyền chủ sở hữu khỏi tổ chức.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getTenants,
  getTenant,
  createTenant,
  updateTenant,
  toggleStatus,
  addOwner,
  removeOwner,
};
