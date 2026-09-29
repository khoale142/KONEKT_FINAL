export const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  SUPPORT_STAFF: 'SUPPORT_STAFF',
  AUDITOR: 'AUDITOR',
};

export const ADMIN_ROLE_LABELS = {
  [ADMIN_ROLES.SUPER_ADMIN]: 'Quản trị viên cấp cao',
  [ADMIN_ROLES.SYSTEM_ADMIN]: 'Quản trị viên hệ thống',
  [ADMIN_ROLES.SUPPORT_STAFF]: 'Nhân viên hỗ trợ',
  [ADMIN_ROLES.AUDITOR]: 'Kiểm toán hệ thống',
};

export default ADMIN_ROLES;
