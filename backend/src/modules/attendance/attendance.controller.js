import * as attendanceService from './attendance.service.js';

export async function getTodayToken(req, res, next) {
  try {
    const token = attendanceService.generateTodayToken(req.workspace.storeId);
    return res.status(200).json({
      success: true,
      data: { token },
    });
  } catch (error) {
    next(error);
  }
}

export async function checkIn(req, res, next) {
  try {
    const { token } = req.body;
    const staffId = req.user.id; // from auth middleware

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Mã token chấm công là bắt buộc.',
      });
    }

    const attendance = await attendanceService.checkIn(staffId, token, req.workspace.storeId);
    return res.status(200).json({
      success: true,
      message: 'Chấm công vào ca (Check-in) thành công.',
      data: attendance,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Chấm công thất bại.',
    });
  }
}

export async function checkOut(req, res, next) {
  try {
    const staffId = req.user.id;

    const attendance = await attendanceService.checkOut(staffId, req.workspace.storeId);
    return res.status(200).json({
      success: true,
      message: 'Chấm công ra ca (Check-out) thành công và ghi nhận lương.',
      data: attendance,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || 'Check-out thất bại.',
    });
  }
}

export async function getLogs(req, res, next) {
  try {
    const { startDate, endDate } = req.query;
    const today = new Date().toISOString().slice(0, 10);
    
    const start = startDate || today;
    const end = endDate || today;

    const logs = await attendanceService.getAttendanceLogs(start, end, req.workspace.storeId);
    return res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}

export async function getTodayStatus(req, res, next) {
  try {
    const staffId = req.user.id;
    const status = await attendanceService.getTodayStaffStatus(staffId, req.workspace.storeId);
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}
