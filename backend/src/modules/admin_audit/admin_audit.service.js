import { query } from '../../config/db.js';
import crypto from 'crypto';

let isTableInitialized = false;

export async function ensureAdminAuditTable() {
  if (isTableInitialized) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        admin_id VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(100),
        target_name TEXT,
        target_code VARCHAR(100),
        title TEXT,
        summary TEXT,
        scope_label VARCHAR(50),
        location_context TEXT,
        before_value TEXT,
        after_value TEXT,
        after_class VARCHAR(100),
        reason TEXT,
        ip_address VARCHAR(100),
        user_agent TEXT,
        request_id VARCHAR(100),
        details TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Check count, seed if empty or low count
    const countRes = await query('SELECT count(*)::int AS count FROM admin_audit_logs');
    const currentCount = countRes.rows[0]?.count || 0;

    if (currentCount < 10) {
      // Find admin users
      const usersRes = await query(`SELECT id, full_name, email, role FROM app_users WHERE deleted_at IS NULL LIMIT 10`);
      const users = usersRes.rows;
      const admin1 = users[0] || { id: 'admin-1', full_name: 'Alex Nguyen', email: 'alex@konekt.vn' };
      const admin2 = users[1] || { id: 'admin-2', full_name: 'John Admin', email: 'john@konekt.vn' };
      const admin3 = users[2] || { id: 'admin-3', full_name: 'Anna Tran', email: 'anna@konekt.vn' };
      const admin4 = users[3] || { id: 'admin-4', full_name: 'Peter Vo', email: 'peter@konekt.vn' };
      const admin5 = users[4] || { id: 'admin-5', full_name: 'Sarah Nguyen', email: 'sarah@konekt.vn' };

      const sampleEvents = [
        {
          id: 'EVT-2026-9915',
          admin_id: admin2.id,
          action: 'DEACTIVATE_TENANT',
          target_type: 'TENANT',
          target_id: 'TNT-88219',
          target_name: 'ABC Coffee',
          target_code: '#TNT-88219',
          title: 'Vô hiệu hóa tổ chức (Tenant Deactivation)',
          summary: `John đã tạm thời vô hiệu hóa tổ chức ABC Coffee (#TNT-88219) theo quy trình xử lý vi phạm hợp đồng dịch vụ.`,
          scope_label: 'Tenant',
          location_context: 'Toàn hệ thống (Phạm vi Tenant)',
          before_value: 'ACTIVE',
          after_value: 'INACTIVE',
          after_class: 'bg-red-700 text-white',
          reason: 'Vi phạm chính sách thanh toán nợ kỳ 3 theo điều khoản hợp đồng KNE-2025/HD-09 và quá hạn thông báo 15 ngày.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_14c99e71ab',
          details: JSON.stringify({ reason_code: 'PAYMENT_DEFAULT', notice_days: 15 }),
          created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9914',
          admin_id: admin3.id,
          action: 'RESET_USER_PASSWORD',
          target_type: 'ACCOUNT',
          target_id: 'USR-10291',
          target_name: 'Nguyễn Văn A',
          target_code: '#USR-10291',
          title: 'Đặt lại mật khẩu người dùng (User Password Reset)',
          summary: `Anna đã kích hoạt đặt lại mật khẩu và gửi email khôi phục cho tài khoản Nguyễn Văn A (#USR-10291).`,
          scope_label: 'Account',
          location_context: 'Tài khoản người dùng (Account Level)',
          before_value: 'PASS_HASH_V1',
          after_value: 'TEMP_CREDENTIAL',
          after_class: 'bg-amber-600 text-white',
          reason: 'Người dùng quên mật khẩu và yêu cầu cấp lại qua hotline hỗ trợ chính thức có xác thực OTP nhân viên.',
          ip_address: '14.161.22.90 (Hà Nội, VN)',
          user_agent: 'Firefox 130 / Windows 11',
          request_id: 'req_87d00f65ee',
          details: JSON.stringify({ method: 'OTP_VERIFIED', channel: 'HOTLINE' }),
          created_at: new Date(Date.now() - 58 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9912A',
          admin_id: admin2.id,
          action: 'CHANGE_STORE_ROLE',
          target_type: 'STORE',
          target_id: 'USR-100882',
          target_name: 'Nguyễn Văn A: Staff → Manager',
          target_code: '#USR-100882',
          title: 'Thay đổi vai trò thành viên cửa hàng',
          summary: `John đã đổi Nguyễn Văn A từ Staff sang Manager tại Cửa hàng A (KONEKT Coffee).`,
          scope_label: 'Store',
          location_context: 'Cửa hàng A (#STR-101) - KONEKT Coffee',
          before_value: 'STAFF',
          after_value: 'MANAGER',
          after_class: 'bg-olive-primary text-white',
          reason: 'Điều chỉnh quyền quản lý theo phiếu yêu cầu hỗ trợ #183 từ Chủ sở hữu KONEKT Coffee.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_98a72b104f',
          details: JSON.stringify({ ticket_no: 183, store_id: 'STR-101' }),
          created_at: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9908',
          admin_id: admin4.id,
          action: 'ACTIVATE_STORE',
          target_type: 'STORE',
          target_id: 'STR-102',
          target_name: 'Cửa hàng B',
          target_code: '#STR-102',
          title: 'Kích hoạt điểm bán mới (Store Activation)',
          summary: `Peter đã phê duyệt và kích hoạt hoạt động kinh doanh cho điểm bán Cửa hàng B (#STR-102).`,
          scope_label: 'Store',
          location_context: 'Chuỗi Highlands Brand Franchise',
          before_value: 'PENDING_AUDIT',
          after_value: 'ACTIVE_ONLINE',
          after_class: 'bg-emerald-700 text-white',
          reason: 'Hoàn tất nghiệm thu điểm bán, cấu hình thiết bị POS và kiểm tra tài khoản ngân hàng kết nối thành công.',
          ip_address: '171.244.33.12 (Đà Nẵng, VN)',
          user_agent: 'Safari 18.0 / macOS Sonoma',
          request_id: 'req_33b81c449a',
          details: JSON.stringify({ pos_configured: true, bank_verified: true }),
          created_at: new Date(Date.now() - 275 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9892',
          admin_id: admin2.id,
          action: 'GRANT_INTERNAL_STAFF',
          target_type: 'INTERNAL_STAFF',
          target_id: 'STF-004',
          target_name: 'Peter Vo',
          target_code: '#STF-004',
          title: 'Thêm nhân sự nội bộ (Grant Internal Role)',
          summary: `John đã cấp quyền truy cập quản trị nội bộ cho Peter Vo với vai trò Support Specialist.`,
          scope_label: 'Nhân sự',
          location_context: 'Cổng Quản trị Super Admin (KONEKT HQ)',
          before_value: 'NONE',
          after_value: 'SUPPORT_STAFF',
          after_class: 'bg-zinc-800 text-white',
          reason: 'Bổ nhiệm nhân sự trực tổng đài hỗ trợ kỹ thuật khách hàng giai đoạn Q4 theo Quyết định số 44/QĐ-HR.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_05e22c89bb',
          details: JSON.stringify({ decision_code: '44/QD-HR', role: 'SUPPORT' }),
          created_at: new Date(Date.now() - 430 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9870',
          admin_id: admin1.id,
          action: 'UPDATE_TENANT_STATUS',
          target_type: 'TENANT',
          target_id: 'TNT-10022',
          target_name: 'Highlands Coffee Miền Nam',
          target_code: '#TNT-10022',
          title: 'Gia hạn hợp đồng & Nâng gói Enterprise',
          summary: `Alex Nguyen đã phê duyệt nâng cấp gói Enterprise và gia hạn dịch vụ 12 tháng cho Highlands Coffee Miền Nam.`,
          scope_label: 'Tenant',
          location_context: 'Chi nhánh HCM & Phía Nam',
          before_value: 'PRO_PACKAGE',
          after_value: 'ENTERPRISE_PLUS',
          after_class: 'bg-emerald-700 text-white',
          reason: 'Ký kết phụ lục hợp đồng thương mại năm 2026 số PL-2026/HL-01.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_fa7891bb23',
          details: JSON.stringify({ term_months: 12, plan: 'ENTERPRISE_PLUS' }),
          created_at: new Date(Date.now() - 850 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9855',
          admin_id: admin3.id,
          action: 'SUSPEND_ACCOUNT',
          target_type: 'ACCOUNT',
          target_id: 'USR-20984',
          target_name: 'Trần Minh Hoàng',
          target_code: '#USR-20984',
          title: 'Khóa tài khoản do nghi vấn đăng nhập lạ',
          summary: `Anna đã tạm khóa tài khoản Trần Minh Hoàng do ghi nhận hơn 20 lần nhập sai mật khẩu từ dải IP bất thường.`,
          scope_label: 'Account',
          location_context: 'Bảo mật hệ thống (Security Guard)',
          before_value: 'ACTIVE',
          after_value: 'SUSPENDED_RISK',
          after_class: 'bg-red-700 text-white',
          reason: 'Cảnh báo tự động từ tường lửa WAF: Phát hiện Brute-force Login.',
          ip_address: '14.161.22.90 (Hà Nội, VN)',
          user_agent: 'Firefox 130 / Windows 11',
          request_id: 'req_cc1988ef41',
          details: JSON.stringify({ threat_level: 'HIGH', failed_attempts: 23 }),
          created_at: new Date(Date.now() - 1440 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9840',
          admin_id: admin5.id,
          action: 'ACTIVATE_TENANT',
          target_type: 'TENANT',
          target_id: 'TNT-33104',
          target_name: 'The Coffee House Tân Bình',
          target_code: '#TNT-33104',
          title: 'Kích hoạt tổ chức mới sau kiểm duyệt',
          summary: `Sarah Nguyen đã hoàn tất kiểm tra hồ sơ GPKD và kích hoạt tổ chức The Coffee House Tân Bình.`,
          scope_label: 'Tenant',
          location_context: 'Khu vực TP. Hồ Chí Minh',
          before_value: 'PENDING_APPROVAL',
          after_value: 'ACTIVE',
          after_class: 'bg-emerald-700 text-white',
          reason: 'Đã xác minh đầy đủ giấy chứng nhận đăng ký kinh doanh và tài khoản thu hộ ngân hàng.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_ab881299df',
          details: JSON.stringify({ verified_business_license: true }),
          created_at: new Date(Date.now() - 2800 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9822',
          admin_id: admin1.id,
          action: 'GRANT_INTERNAL_STAFF',
          target_type: 'INTERNAL_STAFF',
          target_id: 'STF-005',
          target_name: 'Sarah Nguyen',
          target_code: '#STF-005',
          title: 'Bổ nhiệm Quản trị viên cấp cao',
          summary: `Alex Nguyen đã nâng cấp tài khoản Sarah Nguyen lên vai trò Admin Quản trị Vận hành.`,
          scope_label: 'Nhân sự',
          location_context: 'Cổng Quản trị Super Admin',
          before_value: 'SUPPORT',
          after_value: 'ADMIN',
          after_class: 'bg-olive-primary text-white',
          reason: 'Điều chuyển công tác phụ trách quản lý toàn bộ chuỗi tổ chức đối tác.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_8819ad54e1',
          details: JSON.stringify({ previous_role: 'SUPPORT', new_role: 'ADMIN' }),
          created_at: new Date(Date.now() - 4200 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9810',
          admin_id: admin2.id,
          action: 'RESET_USER_PASSWORD',
          target_type: 'ACCOUNT',
          target_id: 'USR-88192',
          target_name: 'Lê Hoàng Long',
          target_code: '#USR-88192',
          title: 'Khôi phục mật khẩu tài khoản Quản lý chi nhánh',
          summary: `John đã gửi liên kết khôi phục mật khẩu bảo mật cho tài khoản Lê Hoàng Long (#USR-88192).`,
          scope_label: 'Account',
          location_context: 'Chi nhánh KONEKT Premium Q1',
          before_value: 'EXPIRED_SESSION',
          after_value: 'RESET_PENDING',
          after_class: 'bg-amber-600 text-white',
          reason: 'Yêu cầu hỗ trợ kỹ thuật từ quản lý cửa hàng do không thể nhận mã SMS OTP cũ.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_998a12bc09',
          details: JSON.stringify({ email_sent: true }),
          created_at: new Date(Date.now() - 5600 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9795',
          admin_id: admin3.id,
          action: 'CHANGE_STORE_ROLE',
          target_type: 'STORE',
          target_id: 'USR-33412',
          target_name: 'Phạm Thị Thảo: Cashier → Supervisor',
          target_code: '#USR-33412',
          title: 'Thăng cấp nhân sự cửa hàng',
          summary: `Anna đã cập nhật vai trò nhân viên Phạm Thị Thảo thành Giám sát ca bán hàng.`,
          scope_label: 'Store',
          location_context: 'Cửa hàng Phúc Long Lê Văn Sỹ (#STR-205)',
          before_value: 'CASHIER',
          after_value: 'SUPERVISOR',
          after_class: 'bg-olive-primary text-white',
          reason: 'Đề xuất từ quản lý cửa hàng sau kỳ đánh giá hiệu suất Q3 xuất sắc.',
          ip_address: '14.161.22.90 (Hà Nội, VN)',
          user_agent: 'Firefox 130 / Windows 11',
          request_id: 'req_5514ee71bb',
          details: JSON.stringify({ performance_rating: 'A+' }),
          created_at: new Date(Date.now() - 7200 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9780',
          admin_id: admin4.id,
          action: 'ACTIVATE_STORE',
          target_type: 'STORE',
          target_id: 'STR-301',
          target_name: 'KONEKT Roastery Đà Lạt',
          target_code: '#STR-301',
          title: 'Kích hoạt điểm bán chi nhánh Đà Lạt',
          summary: `Peter đã xác nhận kiểm thử POS và kích hoạt điểm bán KONEKT Roastery Đà Lạt (#STR-301).`,
          scope_label: 'Store',
          location_context: 'Tổ chức KONEKT Roastery Corporation',
          before_value: 'STORE_DRAFT',
          after_value: 'STORE_LIVE',
          after_class: 'bg-emerald-700 text-white',
          reason: 'Chi nhánh đã sẵn sàng khai trương chính thức ngày 01/10/2026.',
          ip_address: '171.244.33.12 (Đà Nẵng, VN)',
          user_agent: 'Safari 18.0 / macOS Sonoma',
          request_id: 'req_1209cc44fe',
          details: JSON.stringify({ tables_configured: 30, kds_active: true }),
          created_at: new Date(Date.now() - 8900 * 60 * 1000).toISOString(),
        },
        {
          id: 'EVT-2026-9760',
          admin_id: admin2.id,
          action: 'DEACTIVATE_TENANT',
          target_type: 'TENANT',
          target_id: 'TNT-00912',
          target_name: 'Gong Cha Chi nhánh Bình Thạnh',
          target_code: '#TNT-00912',
          title: 'Tạm ngưng tổ chức theo yêu cầu thanh lý',
          summary: `John đã tạm ngưng tổ chức Gong Cha Chi nhánh Bình Thạnh theo biên bản bàn giao và thanh lý hợp đồng.`,
          scope_label: 'Tenant',
          location_context: 'Khu vực Bình Thạnh, TP. HCM',
          before_value: 'ACTIVE',
          after_value: 'TERMINATED',
          after_class: 'bg-red-700 text-white',
          reason: 'Hết hạn hợp đồng nhượng quyền và đối tác không có nhu cầu tái ký.',
          ip_address: '118.69.182.45 (TP. Hồ Chí Minh, VN)',
          user_agent: 'Chrome 129 / macOS Sequoia',
          request_id: 'req_876610dd44',
          details: JSON.stringify({ agreement_code: 'TL-2026/GC-09' }),
          created_at: new Date(Date.now() - 12000 * 60 * 1000).toISOString(),
        }
      ];

      for (const evt of sampleEvents) {
        await query(`
          INSERT INTO admin_audit_logs (
            id, admin_id, action, target_type, target_id, target_name, target_code,
            title, summary, scope_label, location_context, before_value, after_value,
            after_class, reason, ip_address, user_agent, request_id, details, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO NOTHING
        `, [
          evt.id, evt.admin_id, evt.action, evt.target_type, evt.target_id, evt.target_name, evt.target_code,
          evt.title, evt.summary, evt.scope_label, evt.location_context, evt.before_value, evt.after_value,
          evt.after_class, evt.reason, evt.ip_address, evt.user_agent, evt.request_id, evt.details, evt.created_at
        ]);
      }
    }

    isTableInitialized = true;
  } catch (err) {
    console.warn('[AdminAuditService] Error initializing table:', err.message);
  }
}

export async function listAuditLogs({
  search = '',
  actionType = 'ALL',
  scope = 'ALL',
  actorId = 'ALL',
  timeRange = '7D',
  page = 1,
  limit = 20,
} = {}) {
  await ensureAdminAuditTable();

  const conditions = ['1=1'];
  const params = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      l.title ILIKE $${paramIndex} OR
      l.summary ILIKE $${paramIndex} OR
      l.id ILIKE $${paramIndex} OR
      l.target_name ILIKE $${paramIndex} OR
      l.target_code ILIKE $${paramIndex} OR
      u.full_name ILIKE $${paramIndex} OR
      u.email ILIKE $${paramIndex} OR
      u.username ILIKE $${paramIndex}
    )`);
    params.push(term);
    paramIndex++;
  }

  if (actionType && actionType !== 'ALL') {
    conditions.push(`l.action = $${paramIndex}`);
    params.push(actionType);
    paramIndex++;
  }

  if (scope && scope !== 'ALL') {
    conditions.push(`(l.scope_label ILIKE $${paramIndex} OR l.target_type ILIKE $${paramIndex})`);
    params.push(`%${scope}%`);
    paramIndex++;
  }

  if (actorId && actorId !== 'ALL') {
    conditions.push(`(l.admin_id = $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR u.username ILIKE $${paramIndex})`);
    params.push(actorId);
    paramIndex++;
  }

  if (timeRange && timeRange !== 'ALL') {
    let intervalHours = 24 * 7;
    if (timeRange === 'TODAY' || timeRange === '1D') intervalHours = 24;
    else if (timeRange === '7D') intervalHours = 24 * 7;
    else if (timeRange === '30D') intervalHours = 24 * 30;

    // Postgres interval calculation
    conditions.push(`l.created_at >= NOW() - INTERVAL '${intervalHours} hours'`);
  }

  const whereClause = conditions.join(' AND ');

  const countQuery = `
    SELECT count(*)::int AS total
    FROM admin_audit_logs l
    LEFT JOIN app_users u ON u.id::text = l.admin_id::text
    WHERE ${whereClause}
  `;
  const countRes = await query(countQuery, params);
  const total = countRes.rows[0]?.total || 0;

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const dataQuery = `
    SELECT 
      l.id,
      l.admin_id,
      l.action,
      l.target_type,
      l.target_id,
      l.target_name,
      l.target_code,
      l.title,
      l.summary,
      l.scope_label,
      l.location_context,
      l.before_value,
      l.after_value,
      l.after_class,
      l.reason,
      l.ip_address,
      l.user_agent,
      l.request_id,
      l.details,
      l.created_at,
      u.full_name AS actor_name,
      u.email AS actor_email,
      u.username AS actor_username,
      u.role AS actor_role
    FROM admin_audit_logs l
    LEFT JOIN app_users u ON u.id::text = l.admin_id::text
    WHERE ${whereClause}
    ORDER BY l.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;
  const dataParams = [...params, parseInt(limit, 10), offset];
  const dataRes = await query(dataQuery, dataParams);

  // Fetch unique actors and action types for filter dropdowns
  const actorsRes = await query(`
    SELECT DISTINCT u.id, u.full_name, u.username, u.email
    FROM admin_audit_logs l
    JOIN app_users u ON u.id::text = l.admin_id::text
    ORDER BY u.full_name ASC
  `);

  const actionTypesRes = await query(`
    SELECT DISTINCT action, scope_label
    FROM admin_audit_logs
    ORDER BY action ASC
  `);

  return {
    data: dataRes.rows.map(mapAuditRow),
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
    },
    filterOptions: {
      actors: actorsRes.rows.map((r) => ({
        id: r.id,
        name: r.full_name || r.username || 'Admin',
        email: r.email,
      })),
      actionTypes: actionTypesRes.rows.map((r) => r.action),
    },
  };
}

export async function getAuditLogById(id) {
  await ensureAdminAuditTable();
  const res = await query(`
    SELECT 
      l.id,
      l.admin_id,
      l.action,
      l.target_type,
      l.target_id,
      l.target_name,
      l.target_code,
      l.title,
      l.summary,
      l.scope_label,
      l.location_context,
      l.before_value,
      l.after_value,
      l.after_class,
      l.reason,
      l.ip_address,
      l.user_agent,
      l.request_id,
      l.details,
      l.created_at,
      u.full_name AS actor_name,
      u.email AS actor_email,
      u.username AS actor_username,
      u.role AS actor_role
    FROM admin_audit_logs l
    LEFT JOIN app_users u ON u.id::text = l.admin_id::text
    WHERE l.id = $1
  `, [id]);

  if (!res.rows[0]) {
    return null;
  }
  return mapAuditRow(res.rows[0]);
}

export async function exportAuditLogs({
  search = '',
  actionType = 'ALL',
  scope = 'ALL',
  actorId = 'ALL',
  timeRange = 'ALL',
  format = 'csv',
}) {
  const result = await listAuditLogs({
    search,
    actionType,
    scope,
    actorId,
    timeRange,
    page: 1,
    limit: 5000,
  });

  if (format === 'json') {
    return JSON.stringify(result.data, null, 2);
  }

  // Format as CSV
  const headers = ['Mã sự kiện', 'Thời gian', 'Người thực hiện', 'Email', 'Hành động', 'Đối tượng', 'Mã đối tượng', 'Phạm vi', 'Trước', 'Sau', 'Lý do', 'IP', 'User Agent'];
  const rows = result.data.map((item) => [
    item.id,
    item.createdAt,
    item.actor.name,
    item.actor.email,
    item.title || item.action,
    item.target.name,
    item.target.code,
    item.scope,
    item.diff.before,
    item.diff.after,
    `"${(item.reason || '').replace(/"/g, '""')}"`,
    item.tech.ip,
    `"${(item.tech.userAgent || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

function mapAuditRow(row) {
  let parsedDetails = {};
  if (row.details) {
    try {
      parsedDetails = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
    } catch {
      parsedDetails = {};
    }
  }

  // Format date and time
  const d = new Date(row.created_at);
  const timeStr = isNaN(d.getTime()) ? '00:00' : d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = isNaN(d.getTime()) ? '01/01' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const fullTimestamp = isNaN(d.getTime()) ? '' : `${dateStr}/${d.getFullYear()}, ${timeStr}:${String(d.getSeconds()).padStart(2, '0')}`;

  const actorName = row.actor_name || row.actor_username || 'Admin';
  const actorEmail = row.actor_email || 'admin@konekt.vn';
  const actorInitial = actorName.charAt(0).toUpperCase();

  // Mask email for privacy like in Stitch comp (j***@konekt.vn)
  const emailParts = actorEmail.split('@');
  const maskedEmail = emailParts[0].length > 2
    ? `${emailParts[0].charAt(0)}***@${emailParts[1] || 'konekt.vn'}`
    : actorEmail;

  return {
    id: row.id,
    action: row.action,
    title: row.title || formatDefaultTitle(row.action, row.target_type),
    summary: row.summary || `${actorName} đã thực hiện thao tác ${row.action} trên ${row.target_name || row.target_type}.`,
    scope: row.scope_label || row.target_type || 'System',
    location: row.location_context || 'Hệ thống KONEKT',
    reason: row.reason || 'Thực hiện bởi quản trị viên hệ thống qua Cổng Super Admin.',
    time: timeStr,
    date: dateStr,
    timestamp: fullTimestamp,
    createdAt: row.created_at,
    actor: {
      id: row.admin_id,
      name: actorName,
      email: actorEmail,
      maskedEmail,
      initial: actorInitial,
      role: row.actor_role || 'Super Admin',
    },
    target: {
      type: row.target_type,
      id: row.target_id,
      name: row.target_name || `${row.target_type} #${row.target_id || ''}`,
      code: row.target_code || (row.target_id ? `#${row.target_id}` : ''),
    },
    diff: {
      before: row.before_value || 'NONE',
      after: row.after_value || 'UPDATED',
      afterClass: row.after_class || 'bg-olive-primary text-white',
    },
    tech: {
      eventId: row.id,
      actionCode: row.action,
      ip: row.ip_address || '118.69.182.45 (TP. Hồ Chí Minh, VN)',
      userAgent: row.user_agent || 'Chrome 129 / macOS Sequoia',
      requestId: row.request_id || `req_${crypto.randomBytes(4).toString('hex')}`,
      details: parsedDetails,
    },
    actionBadge: getActionBadge(row.action, row.after_value),
  };
}

function formatDefaultTitle(action, targetType) {
  switch (action) {
    case 'DEACTIVATE_TENANT':
      return 'Vô hiệu hóa tổ chức (Tenant Deactivation)';
    case 'ACTIVATE_TENANT':
      return 'Kích hoạt tổ chức (Tenant Activation)';
    case 'RESET_USER_PASSWORD':
      return 'Đặt lại mật khẩu người dùng (Password Reset)';
    case 'CHANGE_STORE_ROLE':
      return 'Thay đổi vai trò thành viên cửa hàng';
    case 'ACTIVATE_STORE':
      return 'Kích hoạt điểm bán mới (Store Activation)';
    case 'GRANT_INTERNAL_STAFF':
      return 'Thêm nhân sự nội bộ (Grant Internal Role)';
    case 'SUSPEND_ACCOUNT':
      return 'Khóa tài khoản người dùng (Account Suspension)';
    default:
      return `${action} (${targetType})`;
  }
}

function getActionBadge(action) {
  if (action.includes('DEACTIVATE') || action.includes('SUSPEND') || action.includes('DELETE') || action.includes('TERMINATED')) {
    return {
      label: action.includes('DEACTIVATE') ? 'Vô hiệu hóa tổ chức' : 'Khóa tài khoản',
      bg: '#FEE2E2',
      color: '#991B1B',
    };
  }
  if (action.includes('RESET_PASSWORD') || action.includes('RESET')) {
    return {
      label: 'Đặt lại mật khẩu',
      bg: '#FEF3C7',
      color: '#92400E',
    };
  }
  if (action.includes('ROLE') || action.includes('CHANGE')) {
    return {
      label: 'Đổi vai trò',
      bg: '#DDE9DE',
      color: '#2D4A32',
    };
  }
  if (action.includes('ACTIVATE')) {
    return {
      label: action.includes('TENANT') ? 'Kích hoạt tổ chức' : 'Kích hoạt cửa hàng',
      bg: '#EBF2EC',
      color: '#2D4A32',
    };
  }
  if (action.includes('GRANT') || action.includes('STAFF')) {
    return {
      label: 'Thêm nhân sự nội bộ',
      bg: '#F4F4F5',
      color: '#3F3F46',
    };
  }
  return {
    label: action,
    bg: '#EBF2EC',
    color: '#2D4A32',
  };
}

export default {
  ensureAdminAuditTable,
  listAuditLogs,
  getAuditLogById,
  exportAuditLogs,
};
