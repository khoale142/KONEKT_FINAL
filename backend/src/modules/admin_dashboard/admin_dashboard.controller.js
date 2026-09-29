import { sendSuccess } from '../../utils/apiResponse.js';
import adminDashboardService from './admin_dashboard.service.js';

export async function getDashboard(req, res, next) {
  try {
    const data = await adminDashboardService.getSystemDashboardStats();
    return sendSuccess(res, {
      message: 'Lấy dữ liệu tổng quan hệ thống thành công.',
      data,
    });
  } catch (error) {
    next(error);
  }
}

export default {
  getDashboard,
};
