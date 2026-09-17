import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

export async function getActiveSession(staffId, storeId) {
  const result = await query(
    `SELECT id, staff_id, opened_at, starting_cash, status, notes,
            mid_shift_cash, mid_shift_counted_at, mid_shift_expected, mid_shift_discrepancy, mid_shift_notes
     FROM pos_sessions
     WHERE staff_id = $1 AND store_id = $2 AND status = 'OPEN'
     LIMIT 1`,
    [staffId, storeId]
  );
  
  if (result.rows.length === 0) {
    return null;
  }

  const session = result.rows[0];
  
  // Calculate if shift has been open for more than 12 hours (UTC+7 / real-time)
  const openedAt = new Date(session.opened_at);
  const now = new Date();
  const diffHours = (now - openedAt) / (1000 * 60 * 60);
  
  session.shouldWarnClose = diffHours > 12;

  // Calculate Cash Sales so far in this session
  const ordersResult = await query(
    `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS cash_sales
     FROM orders
     WHERE pos_session_id = $1 
       AND payment_method = 'CASH' 
       AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')`,
    [session.id]
  );
  
  session.cashSales = Number(ordersResult.rows[0].cash_sales);

  // Total VietQR sales
  const qrSalesResult = await query(
    `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS qr_sales
     FROM orders
     WHERE pos_session_id = $1 
       AND payment_method = 'QR' 
       AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')`,
    [session.id]
  );
  session.qrSales = Number(qrSalesResult.rows[0].qr_sales);

  // Calculate expected cash in drawer
  if (session.mid_shift_cash !== null && session.mid_shift_counted_at !== null) {
    const afterResult = await query(
      `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS cash_sales
       FROM orders
       WHERE pos_session_id = $1 
         AND payment_method = 'CASH' 
         AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
         AND created_at > $2`,
      [session.id, session.mid_shift_counted_at]
    );
    const cashSalesAfter = Number(afterResult.rows[0].cash_sales);
    session.endingCashExpected = Number(session.mid_shift_cash) + cashSalesAfter;
  } else {
    session.endingCashExpected = Number(session.starting_cash) + session.cashSales;
  }
  
  return session;
}

export async function openSession(staffId, startingCash, notes, storeId) {
  // Check if there is already an active session
  const activeSession = await getActiveSession(staffId, storeId);
  if (activeSession) {
    throw new ApiError(400, 'Bạn đang có một ca làm việc chưa đóng. Vui lòng kết ca hiện tại trước.');
  }

  const cashVal = Number(startingCash);
  if (isNaN(cashVal) || cashVal < 0) {
    throw new ApiError(400, 'Tiền mặt đầu ca không hợp lệ.');
  }

  const result = await query(
    `INSERT INTO pos_sessions (staff_id, starting_cash, status, notes, store_id)
     VALUES ($1, $2, 'OPEN', $3, $4)
     RETURNING id, staff_id, opened_at, starting_cash, status, notes`,
    [staffId, cashVal, notes || null, storeId]
  );

  return result.rows[0];
}

export async function closeSession(sessionId, endingCashActual, notes, storeId) {
  // Find session
  const result = await query(
    `SELECT id, staff_id, opened_at, starting_cash, status, mid_shift_cash, mid_shift_counted_at
     FROM pos_sessions
     WHERE id = $1 AND store_id = $2 AND status = 'OPEN'`,
    [sessionId, storeId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Không tìm thấy ca làm việc đang mở hoặc ca đã được đóng trước đó.');
  }

  const session = result.rows[0];
  const startingCash = Number(session.starting_cash);
  const actualCash = Number(endingCashActual);

  if (isNaN(actualCash) || actualCash < 0) {
    throw new ApiError(400, 'Tiền mặt thực tế đếm được không hợp lệ.');
  }

  let endingCashExpected;
  if (session.mid_shift_cash !== null && session.mid_shift_counted_at !== null) {
    // If mid-shift count was performed, expected final cash = mid_shift_cash + cash sales after that count
    const ordersResult = await query(
      `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS cash_sales
       FROM orders
       WHERE pos_session_id = $1 
         AND payment_method = 'CASH' 
         AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
         AND created_at > $2`,
      [sessionId, session.mid_shift_counted_at]
    );
    const cashSalesAfter = Number(ordersResult.rows[0].cash_sales);
    endingCashExpected = Number(session.mid_shift_cash) + cashSalesAfter;
  } else {
    // Standard calculation: starting_cash + total cash sales
    const ordersResult = await query(
      `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS cash_sales
       FROM orders
       WHERE pos_session_id = $1 
         AND payment_method = 'CASH' 
         AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')`,
      [sessionId]
    );
    const cashSales = Number(ordersResult.rows[0].cash_sales);
    endingCashExpected = startingCash + cashSales;
  }

  const discrepancy = actualCash - endingCashExpected;

  // Time check: standard shift duration check (> 12 hours)
  const openedAt = new Date(session.opened_at);
  const now = new Date();
  const diffHours = (now - openedAt) / (1000 * 60 * 60);
  const isOverdue = diffHours > 12;

  const updateResult = await query(
    `UPDATE pos_sessions
     SET closed_at = NOW(),
         ending_cash_expected = $1,
         ending_cash_actual = $2,
         discrepancy = $3,
         status = 'CLOSED',
         is_overdue = $4,
         notes = COALESCE($5, notes)
     WHERE id = $6 AND store_id = $7
     RETURNING *`,
    [endingCashExpected, actualCash, discrepancy, isOverdue, notes || null, sessionId, storeId]
  );

  return updateResult.rows[0];
}

export async function listSessions({ staffId, dateFrom, dateTo } = {}, storeId) {
  const params = [storeId];
  const conditions = ['s.store_id = $1'];

  if (staffId) {
    params.push(staffId);
    conditions.push(`s.staff_id = $${params.length}`);
  }

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`s.opened_at::date >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`s.opened_at::date <= $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `SELECT s.id, s.staff_id, u.full_name as staff_name, u.username as staff_username,
            s.opened_at, s.closed_at, s.starting_cash, s.ending_cash_expected,
            s.ending_cash_actual, s.discrepancy, s.status, s.is_overdue, s.notes,
            s.mid_shift_cash, s.mid_shift_counted_at, s.mid_shift_expected,
            s.mid_shift_discrepancy, s.mid_shift_notes
     FROM pos_sessions s
     JOIN app_users u ON u.id = s.staff_id
     ${whereClause}
     ORDER BY s.opened_at DESC`,
    params
  );

  return result.rows;
}

export async function midShiftCountSession(sessionId, midShiftCash, notes, storeId) {
  // Find session
  const result = await query(
    `SELECT id, staff_id, opened_at, starting_cash, status
     FROM pos_sessions
     WHERE id = $1 AND store_id = $2 AND status = 'OPEN'`,
    [sessionId, storeId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(404, 'Không tìm thấy ca làm việc đang mở.');
  }

  const session = result.rows[0];
  const startingCash = Number(session.starting_cash);
  const countedCash = Number(midShiftCash);

  if (isNaN(countedCash) || countedCash < 0) {
    throw new ApiError(400, 'Số tiền bàn giao ca sáng không hợp lệ.');
  }

  const now = new Date(); // Time of check (handover)

  // Calculate Cash Sales from opened_at to now
  const ordersResult = await query(
    `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS cash_sales
     FROM orders
     WHERE pos_session_id = $1 
       AND payment_method = 'CASH' 
       AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')
       AND created_at <= $2`,
    [sessionId, now]
  );

  const cashSalesBefore = Number(ordersResult.rows[0].cash_sales);
  const expectedCash = startingCash + cashSalesBefore;
  const discrepancy = countedCash - expectedCash;

  // Save to database
  const updateResult = await query(
    `UPDATE pos_sessions
     SET mid_shift_cash = $1,
         mid_shift_counted_at = $2,
         mid_shift_expected = $3,
         mid_shift_discrepancy = $4,
         mid_shift_notes = $5
     WHERE id = $6 AND store_id = $7
     RETURNING *`,
    [countedCash, now, expectedCash, discrepancy, notes || null, sessionId, storeId]
  );

  return updateResult.rows[0];
}

export async function getSessionReport(sessionId, storeId) {
  // Find session
  const sessionResult = await query(
    `SELECT s.id, s.staff_id, u.full_name as staff_name, u.username as staff_username,
            s.opened_at, s.closed_at, s.starting_cash, s.ending_cash_expected,
            s.ending_cash_actual, s.discrepancy, s.status, s.is_overdue, s.notes,
            s.mid_shift_cash, s.mid_shift_counted_at, s.mid_shift_expected,
            s.mid_shift_discrepancy, s.mid_shift_notes
     FROM pos_sessions s
     JOIN app_users u ON u.id = s.staff_id
     WHERE s.id = $1 AND s.store_id = $2`,
    [sessionId, storeId]
  );

  if (sessionResult.rows.length === 0) {
    throw new ApiError(404, 'Không tìm thấy ca làm việc.');
  }

  const session = sessionResult.rows[0];

  // Cash sales, QR sales, Total sales
  const cashSalesResult = await query(
    `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS sales
     FROM orders
     WHERE pos_session_id = $1 
       AND payment_method = 'CASH' 
       AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')`,
    [sessionId]
  );

  const qrSalesResult = await query(
    `SELECT COALESCE(SUM(total_amount - COALESCE(refunded_amount, 0)), 0) AS sales
     FROM orders
     WHERE pos_session_id = $1 
       AND payment_method = 'QR' 
       AND status IN ('SUCCESS', 'PARTIALLY_REFUNDED', 'REFUNDED')`,
    [sessionId]
  );

  session.cashSales = Number(cashSalesResult.rows[0].sales);
  session.qrSales = Number(qrSalesResult.rows[0].sales);
  session.totalSales = session.cashSales + session.qrSales;

  // List of orders in this session
  const ordersResult = await query(
    `SELECT id, order_code as order_no, created_at, total_amount, payment_method, status
     FROM orders
     WHERE pos_session_id = $1
     ORDER BY created_at DESC`,
    [sessionId]
  );

  return {
    session,
    orders: ordersResult.rows,
  };
}
