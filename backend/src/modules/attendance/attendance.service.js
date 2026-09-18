import { query } from '../../config/db.js';
import crypto from 'crypto';

const ATTENDANCE_SALT = 'mini-coffee-pos-salt-2026';

export function generateTodayToken(storeId) {
  if (!storeId) {
    throw new Error('Store context is required to generate an attendance token.');
  }
  const todayStr = new Date().toISOString().slice(0, 10);
  return crypto
    .createHash('sha256')
    .update(ATTENDANCE_SALT + storeId + todayStr)
    .digest('hex');
}

export async function checkIn(staffId, token, storeId) {
  // 1. Verify token
  const expectedToken = generateTodayToken(storeId);
  if (token !== expectedToken) {
    throw new Error('Mã QR chấm công không hợp lệ hoặc đã hết hạn.');
  }

  // 2. Find active shift assigned for today that hasn't been checked in
  const today = new Date().toISOString().slice(0, 10);
  const activeShiftResult = await query(
    `SELECT ss.id, ss.custom_start_time, s.start_time, s.name as shift_name
     FROM staff_shifts ss
     JOIN shifts s ON s.id = ss.shift_id
     WHERE ss.staff_id = $1 AND ss.shift_date = $2 AND ss.store_id = $3 AND ss.check_in_at IS NULL`,
    [staffId, today, storeId]
  );

  if (activeShiftResult.rows.length === 0) {
    throw new Error('Bạn không có ca làm việc nào được phân công hôm nay hoặc đã check-in rồi.');
  }

  const shiftRow = activeShiftResult.rows[0];
  const shiftId = shiftRow.id;
  const scheduledStart = shiftRow.custom_start_time || shiftRow.start_time;

  // 3. Calculate lateness
  const now = new Date();
  const currentHourMin = now.toTimeString().slice(0, 5); // "HH:MM"
  
  const [currH, currM] = currentHourMin.split(':').map(Number);
  const [schedH, schedM] = scheduledStart.split(':').map(Number);
  
  const currMinutes = currH * 60 + currM;
  const schedMinutes = schedH * 60 + schedM;
  let lateness = currMinutes - schedMinutes;
  if (lateness < 0) lateness = 0; // early or on time

  // 4. Update check-in time and lateness
  const result = await query(
    `UPDATE staff_shifts
     SET check_in_at = NOW(), lateness_minutes = $1, updated_at = NOW()
     WHERE id = $2 AND store_id = $3
     RETURNING *`,
    [lateness, shiftId, storeId]
  );

  return result.rows[0];
}

export async function checkOut(staffId, storeId) {
  const today = new Date().toISOString().slice(0, 10);

  // 1. Find active shift that is checked in but not checked out
  const checkedInResult = await query(
    `SELECT ss.id, ss.check_in_at, ss.hourly_rate_snapshot, ss.lateness_minutes,
            COALESCE(ss.custom_start_time, s.start_time) as start_time,
            COALESCE(ss.custom_end_time, s.end_time) as end_time
     FROM staff_shifts ss
     JOIN shifts s ON s.id = ss.shift_id
     WHERE ss.staff_id = $1 AND ss.shift_date = $2 AND ss.store_id = $3 AND ss.check_in_at IS NOT NULL AND ss.check_out_at IS NULL`,
    [staffId, today, storeId]
  );

  if (checkedInResult.rows.length === 0) {
    throw new Error('Không tìm thấy lượt chấm công hợp lệ để check-out hôm nay.');
  }

  const shiftRow = checkedInResult.rows[0];
  const shiftId = shiftRow.id;
  const checkInAt = new Date(shiftRow.check_in_at);
  const now = new Date();

  // 2. Calculate actual hours worked
  const diffMs = now - checkInAt;
  const actualHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // round to 2 decimals

  // 3. Calculate salary based on planned hours minus lateness
  const [startH, startM] = shiftRow.start_time.split(':').map(Number);
  const [endH, endM] = shiftRow.end_time.split(':').map(Number);
  let plannedHours = (endH * 60 + endM - (startH * 60 + startM)) / 60;
  if (plannedHours < 0) plannedHours += 24;

  const latenessHours = shiftRow.lateness_minutes / 60;
  const payableHours = Math.max(0, plannedHours - latenessHours);
  const rate = Number(shiftRow.hourly_rate_snapshot);
  const totalSalary = Math.round(payableHours * rate);

  // 4. Update check-out
  const result = await query(
    `UPDATE staff_shifts
     SET check_out_at = NOW(), actual_hours = $1, total_salary = $2, status = 'COMPLETED', updated_at = NOW()
     WHERE id = $3 AND store_id = $4
     RETURNING *`,
    [actualHours, totalSalary, shiftId, storeId]
  );

  return result.rows[0];
}

export async function getAttendanceLogs(startDate, endDate, storeId) {
  const result = await query(
    `SELECT ss.id, ss.shift_date::text as shift_date, ss.check_in_at, ss.check_out_at, ss.lateness_minutes, ss.actual_hours, ss.total_salary, ss.status,
            u.full_name as staff_name, u.username as staff_username,
            s.name as shift_name,
            COALESCE(ss.custom_start_time, s.start_time) as planned_start,
            COALESCE(ss.custom_end_time, s.end_time) as planned_end
     FROM staff_shifts ss
     JOIN app_users u ON u.id = ss.staff_id
     JOIN shifts s ON s.id = ss.shift_id
     WHERE ss.shift_date BETWEEN $1 AND $2 AND ss.store_id = $3
     ORDER BY ss.shift_date DESC, ss.check_in_at DESC`,
    [startDate, endDate, storeId]
  );
  return result.rows;
}

export async function getTodayStaffStatus(staffId, storeId) {
  const today = new Date().toISOString().slice(0, 10);
  const result = await query(
    `SELECT ss.id, ss.check_in_at, ss.check_out_at, ss.lateness_minutes, ss.actual_hours, ss.status,
            s.name as shift_name,
            COALESCE(ss.custom_start_time, s.start_time) as planned_start,
            COALESCE(ss.custom_end_time, s.end_time) as planned_end
     FROM staff_shifts ss
     JOIN shifts s ON s.id = ss.shift_id
     WHERE ss.staff_id = $1 AND ss.shift_date = $2 AND ss.store_id = $3`,
    [staffId, today, storeId]
  );
  return result.rows[0] || null;
}
