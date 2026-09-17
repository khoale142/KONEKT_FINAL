import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as hrService from './hr.service.js';

// Helper to check if string is UUID
function isUUID(str) {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
}

// --- SHIFTS ---

export const getShifts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const shifts = await hrService.listShifts(storeId);
  return sendSuccess(res, {
    message: 'Danh sách ca làm việc loaded thành công.',
    data: { shifts },
  });
});

export const createNewShift = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { name, start_time, end_time, hourly_rate } = req.body;

  if (!name || name.trim() === '') {
    throw new Error('Tên ca làm việc không được trống.');
  }
  if (!start_time || !end_time) {
    throw new Error('Thời gian bắt đầu và kết thúc không được trống.');
  }
  if (hourly_rate === undefined || Number(hourly_rate) < 0 || isNaN(Number(hourly_rate))) {
    throw new Error('Đơn giá lương mỗi giờ phải là số không âm.');
  }

  const shift = await hrService.createShift({ name, start_time, end_time, hourly_rate }, storeId);
  return sendSuccess(res, {
    message: 'Tạo ca làm việc thành công.',
    statusCode: 201,
    data: { shift },
  });
});

export const updateExistingShift = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { name, start_time, end_time, hourly_rate } = req.body;
  const { id } = req.params;

  if (!isUUID(id)) {
    throw new Error('ID ca làm việc không hợp lệ.');
  }
  if (!name || name.trim() === '') {
    throw new Error('Tên ca làm việc không được trống.');
  }
  if (!start_time || !end_time) {
    throw new Error('Thời gian bắt đầu và kết thúc không được trống.');
  }
  if (hourly_rate === undefined || Number(hourly_rate) < 0 || isNaN(Number(hourly_rate))) {
    throw new Error('Đơn giá lương mỗi giờ phải là số không âm.');
  }

  const shift = await hrService.updateShift(id, { name, start_time, end_time, hourly_rate }, storeId);
  return sendSuccess(res, {
    message: 'Cập nhật ca làm việc thành công.',
    data: { shift },
  });
});

export const deleteExistingShift = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { id } = req.params;
  if (!isUUID(id)) {
    throw new Error('ID ca làm việc không hợp lệ.');
  }
  await hrService.deleteShift(id, storeId);
  return sendSuccess(res, {
    message: 'Xóa ca làm việc thành công.',
  });
});

// --- AVAILABILITY ---

export const getAvailabilities = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { staff_id, start_date, end_date } = req.query;

  // By default, if the route requires owner, then req.user is an owner.
  // Actually, we will split this logic in routes or just check the role here.
  // If we just rely on query staff_id... Wait, if staff calls this, staff_id is overridden.
  // We'll let routes pass the correct query. Actually let's just use what's passed in query for now.
  // If owner, they can query specific staff. If staff, they must query themselves.
  
  // Let's assume the route will handle role checks. But wait, `staff` vs `owner`.
  // Owner can view all (if staff_id is omitted).
  // Let's check `req.workspace.isOwner` maybe? No, we don't have that. Let's just use `req.user.role` 
  // Wait, roles are Account level. In workspace, we should check `req.workspace.role`.
  // The middleware doesn't set `req.workspace.role`. 
  // It's better to create 2 separate controller functions for staff vs owner, 
  // or just always filter by `staff_id = req.user.id` for staff route.
  // Let's create `getAvailabilitiesForStaff` and `getAvailabilitiesForOwner`.

  const queryStaffId = staff_id; // For owner, it's optional.

  const availabilities = await hrService.listAvailability({
    staff_id: queryStaffId,
    start_date,
    end_date,
  }, storeId);

  return sendSuccess(res, {
    message: 'Danh sách lịch rảnh loaded thành công.',
    data: { availabilities },
  });
});

export const getMyAvailabilities = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { start_date, end_date } = req.query;
  const staffId = req.user.id;

  const availabilities = await hrService.listAvailability({
    staff_id: staffId,
    start_date,
    end_date,
  }, storeId);

  return sendSuccess(res, {
    message: 'Danh sách lịch rảnh loaded thành công.',
    data: { availabilities },
  });
});

export const createNewAvailability = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { available_date, start_time, end_time, note } = req.body;
  const staffId = req.user.id;

  if (!available_date || isNaN(Date.parse(available_date))) {
    throw new Error('Ngày báo rảnh không hợp lệ.');
  }
  if (!start_time || !end_time) {
    throw new Error('Thời gian bắt đầu và kết thúc không được trống.');
  }

  const availability = await hrService.createAvailability(staffId, {
    available_date,
    start_time,
    end_time,
    note,
  }, storeId);

  return sendSuccess(res, {
    message: 'Đăng ký lịch báo rảnh thành công.',
    statusCode: 201,
    data: { availability },
  });
});

export const deleteMyAvailability = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { id } = req.params;
  if (!isUUID(id)) {
    throw new Error('ID lịch rảnh không hợp lệ.');
  }

  await hrService.deleteAvailability(id, req.user.id, false, storeId);

  return sendSuccess(res, {
    message: 'Xóa đăng ký lịch rảnh thành công.',
  });
});

export const deleteExistingAvailability = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { id } = req.params;
  if (!isUUID(id)) {
    throw new Error('ID lịch rảnh không hợp lệ.');
  }

  await hrService.deleteAvailability(id, req.user.id, true, storeId);

  return sendSuccess(res, {
    message: 'Xóa đăng ký lịch rảnh thành công.',
  });
});

// --- SHIFT ASSIGNMENT ---

export const getAssignedShifts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { staff_id, start_date, end_date } = req.query;

  const shifts = await hrService.listAssignedShifts({
    staff_id,
    start_date,
    end_date,
  }, storeId);

  return sendSuccess(res, {
    message: 'Lịch phân ca loaded thành công.',
    data: { shifts },
  });
});

export const getMyAssignedShifts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { start_date, end_date } = req.query;
  const staffId = req.user.id;

  const shifts = await hrService.listAssignedShifts({
    staff_id: staffId,
    start_date,
    end_date,
  }, storeId);

  return sendSuccess(res, {
    message: 'Lịch phân ca loaded thành công.',
    data: { shifts },
  });
});


export const assignNewShift = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { staff_id, shift_id, shift_date, custom_start_time, custom_end_time } = req.body;

  if (!staff_id || !isUUID(staff_id)) {
    throw new Error('Nhân viên không hợp lệ.');
  }
  if (!shift_id || !isUUID(shift_id)) {
    throw new Error('Ca làm việc không hợp lệ.');
  }
  if (!shift_date || isNaN(Date.parse(shift_date))) {
    throw new Error('Ngày phân ca không hợp lệ.');
  }

  const assignedShift = await hrService.assignShift(req.user.id, {
    staff_id,
    shift_id,
    shift_date,
    custom_start_time,
    custom_end_time,
  }, storeId);

  return sendSuccess(res, {
    message: 'Phân công ca làm thành công.',
    statusCode: 201,
    data: { assignedShift },
  });
});

export const changeShiftStatus = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { id } = req.params;
  const { status } = req.body;

  if (!isUUID(id)) {
    throw new Error('ID phân ca không hợp lệ.');
  }
  if (!status || !['ASSIGNED', 'COMPLETED', 'ABSENT'].includes(status)) {
    throw new Error('Trạng thái ca làm không hợp lệ.');
  }

  const assignedShift = await hrService.updateShiftStatus(id, status, storeId);
  return sendSuccess(res, {
    message: 'Cập nhật trạng thái ca làm thành công.',
    data: { assignedShift },
  });
});

export const deleteAssignedShift = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { id } = req.params;
  if (!isUUID(id)) {
    throw new Error('ID phân ca không hợp lệ.');
  }

  await hrService.deleteShiftAssignment(id, storeId);
  return sendSuccess(res, {
    message: 'Xóa lịch phân ca thành công.',
  });
});

// --- REQUESTS ---

export const getRequests = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { staff_id, status } = req.query;

  const requests = await hrService.listRequests({
    staff_id,
    status,
  }, storeId);

  return sendSuccess(res, {
    message: 'Danh sách yêu cầu loaded thành công.',
    data: { requests },
  });
});

export const getMyRequests = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { status } = req.query;
  const staffId = req.user.id;

  const requests = await hrService.listRequests({
    staff_id: staffId,
    status,
  }, storeId);

  return sendSuccess(res, {
    message: 'Danh sách yêu cầu loaded thành công.',
    data: { requests },
  });
});

export const createNewRequest = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { type, reason, target_date, target_shift_id, swap_with_staff_id } = req.body;
  const staffId = req.user.id;

  if (!type || !['LEAVE', 'SWAP'].includes(type)) {
    throw new Error('Loại yêu cầu không hợp lệ.');
  }
  if (!reason || reason.trim() === '') {
    throw new Error('Lý do gửi yêu cầu không được để trống.');
  }
  if (!target_date || isNaN(Date.parse(target_date))) {
    throw new Error('Ngày áp dụng yêu cầu không hợp lệ.');
  }
  if (type === 'SWAP') {
    if (!target_shift_id || !isUUID(target_shift_id)) {
      throw new Error('Ca làm việc cần đổi không hợp lệ.');
    }
    if (!swap_with_staff_id || !isUUID(swap_with_staff_id)) {
      throw new Error('Nhân viên nhận đổi ca không hợp lệ.');
    }
    if (swap_with_staff_id === staffId) {
      throw new Error('Không thể tự đổi ca với chính mình.');
    }
  }

  const request = await hrService.createRequest(staffId, {
    type,
    reason,
    target_date,
    target_shift_id,
    swap_with_staff_id,
  }, storeId);

  return sendSuccess(res, {
    message: 'Gửi yêu cầu thành công và đang chờ duyệt.',
    statusCode: 201,
    data: { request },
  });
});

export const processExistingRequest = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { id } = req.params;
  const { status, admin_note } = req.body;

  if (!isUUID(id)) {
    throw new Error('ID yêu cầu không hợp lệ.');
  }
  if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
    throw new Error('Trạng thái phê duyệt không hợp lệ.');
  }

  const request = await hrService.processRequest(req.user.id, id, {
    status,
    admin_note,
  }, storeId);

  return sendSuccess(res, {
    message: status === 'APPROVED' ? 'Phê duyệt yêu cầu thành công.' : 'Từ chối yêu cầu thành công.',
    data: { request },
  });
});

// --- REPORTS ---

export const getMySalary = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { start_date, end_date } = req.query;
  const staffId = req.user.id;

  if (!start_date || !end_date) {
    throw new Error('Vui lòng chọn khoảng thời gian bắt đầu và kết thúc.');
  }

  const summary = await hrService.getSalarySummary(staffId, { start_date, end_date }, storeId);
  return sendSuccess(res, {
    message: 'Tải thông tin phiếu lương thành công.',
    data: { summary },
  });
});

export const getAdminHRCosts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    throw new Error('Vui lòng chọn khoảng thời gian bắt đầu và kết thúc.');
  }

  const costs = await hrService.getHRCostReport({ start_date, end_date }, storeId);
  return sendSuccess(res, {
    message: 'Tải báo cáo chi phí nhân sự thành công.',
    data: { costs },
  });
});

export const getStaffList = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const staff = await hrService.getActiveStaffList(storeId);
  return sendSuccess(res, {
    message: 'Staff list loaded successfully.',
    data: { staff },
  });
});
