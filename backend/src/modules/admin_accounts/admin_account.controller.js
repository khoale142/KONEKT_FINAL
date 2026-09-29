import { sendSuccess } from '../../utils/apiResponse.js';
import adminAccountService from './admin_account.service.js';

export async function getAccounts(req, res, next) {
  try {
    const { search, status, relation, sort, page, limit } = req.query;
    const result = await adminAccountService.listAccounts({
      search,
      status,
      relation,
      sort,
      page,
      limit,
    });
    return sendSuccess(res, {
      message: 'Lấy danh sách tài khoản thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAccount(req, res, next) {
  try {
    const { id } = req.params;
    const account = await adminAccountService.getAccountById(id);
    return sendSuccess(res, {
      message: 'Lấy thông tin tài khoản thành công.',
      data: account,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAccount(req, res, next) {
  try {
    const { username, email, full_name, password, status } = req.body;
    const account = await adminAccountService.createAccount(
      { username, email, full_name, password, status },
      req.admin.id
    );
    return sendSuccess(res, {
      message: 'Tạo tài khoản mới thành công.',
      data: account,
      statusCode: 201,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAccount(req, res, next) {
  try {
    const { id } = req.params;
    const account = await adminAccountService.updateAccount(id, req.body, req.admin.id);
    return sendSuccess(res, {
      message: 'Cập nhật tài khoản thành công.',
      data: account,
    });
  } catch (error) {
    next(error);
  }
}

export async function toggleAccountStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const account = await adminAccountService.toggleAccountStatus(id, status, reason, req.admin.id);
    return sendSuccess(res, {
      message: status === 'ACTIVE' ? 'Kích hoạt tài khoản thành công.' : 'Vô hiệu hóa tài khoản thành công.',
      data: account,
    });
  } catch (error) {
    next(error);
  }
}

export async function resetAccountPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const result = await adminAccountService.resetAccountPassword(id, newPassword, req.admin.id);
    return sendSuccess(res, {
      message: 'Đặt lại mật khẩu tài khoản thành công.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  toggleAccountStatus,
  resetAccountPassword,
};
