import { query } from '../config/db.js';

export async function logAdminAction({
  adminId,
  action,
  targetType,
  targetId = null,
  details = {},
  ipAddress = null,
  userAgent = null,
}) {
  try {
    // Check if admin_audit_logs table exists, if so insert
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
      [
        adminId,
        action,
        targetType,
        targetId,
        JSON.stringify(details),
        ipAddress,
        userAgent,
      ]
    ).catch(() => {
      // If table does not exist yet, log to console gracefully
      console.log(`[AdminAudit] Admin: ${adminId} | Action: ${action} | Target: ${targetType}:${targetId}`);
    });
  } catch (err) {
    console.warn('[AdminAudit] Failed to record audit log:', err.message);
  }
}

export default {
  logAdminAction,
};
