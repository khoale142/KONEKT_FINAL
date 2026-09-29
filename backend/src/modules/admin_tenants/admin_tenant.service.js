import { query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { logAdminAction } from '../../utils/adminAudit.js';

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export async function listTenants({ search = '', status = 'ALL', sort = 'newest', page = 1, limit = 10 }) {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const parsedLimit = parseInt(limit, 10);

  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (search && search.trim()) {
    conditions.push(`(lower(t.name) LIKE $${paramIndex} OR lower(coalesce(t.slug, '')) LIKE $${paramIndex} OR lower(coalesce(t.email, '')) LIKE $${paramIndex})`);
    params.push(`%${search.trim().toLowerCase()}%`);
    paramIndex++;
  }

  if (status && status !== 'ALL') {
    conditions.push(`t.status = $${paramIndex}`);
    params.push(status.toUpperCase());
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Order clause
  let orderClause = 'ORDER BY t.created_at DESC';
  if (sort === 'name_asc') orderClause = 'ORDER BY t.name ASC';
  if (sort === 'name_desc') orderClause = 'ORDER BY t.name DESC';
  if (sort === 'oldest') orderClause = 'ORDER BY t.created_at ASC';
  if (sort === 'stores_desc') orderClause = 'ORDER BY stores_count DESC, t.created_at DESC';

  // Query with store count and members count
  const listSql = `
    SELECT 
      t.id,
      t.name,
      t.slug,
      t.email,
      t.phone,
      t.address,
      t.status,
      t.created_at,
      t.updated_at,
      COALESCE(s.stores_count, 0)::int AS stores_count,
      COALESCE(m.members_count, 0)::int AS members_count
    FROM tenants t
    LEFT JOIN (
      SELECT tenant_id, count(*)::int AS stores_count
      FROM stores
      GROUP BY tenant_id
    ) s ON s.tenant_id = t.id
    LEFT JOIN (
      SELECT tow.tenant_id, count(DISTINCT tow.user_id)::int AS members_count
      FROM tenant_owners tow
      GROUP BY tow.tenant_id
    ) m ON m.tenant_id = t.id
    ${whereClause}
    ${orderClause}
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  const countSql = `
    SELECT count(*)::int AS total
    FROM tenants t
    ${whereClause}
  `;

  const countsBreakdownSql = `
    SELECT 
      count(*)::int AS all_count,
      count(*) FILTER (WHERE status = 'ACTIVE')::int AS active_count,
      count(*) FILTER (WHERE status = 'INACTIVE')::int AS inactive_count
    FROM tenants
  `;

  const [listResult, countResult, breakdownResult] = await Promise.all([
    query(listSql, [...params, parsedLimit, offset]),
    query(countSql, params),
    query(countsBreakdownSql),
  ]);

  const total = countResult.rows[0]?.total || 0;
  const breakdown = breakdownResult.rows[0] || { all_count: 0, active_count: 0, inactive_count: 0 };

  return {
    tenants: listResult.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit) || 1,
    },
    counts: breakdown,
  };
}

export async function getTenantById(tenantId) {
  const tenantRes = await query(
    `SELECT t.id, t.name, t.slug, t.email, t.phone, t.address, t.status, t.created_at, t.updated_at
     FROM tenants t
     WHERE t.id = $1`,
    [tenantId]
  );

  const tenant = tenantRes.rows[0];
  if (!tenant) {
    throw new ApiError(404, 'Không tìm thấy thông tin tổ chức.');
  }

  // Get owners
  const ownersRes = await query(
    `SELECT u.id, u.username, u.email, u.full_name, u.status, tow.joined_at
     FROM tenant_owners tow
     JOIN app_users u ON u.id = tow.user_id
     WHERE tow.tenant_id = $1 AND u.deleted_at IS NULL`,
    [tenantId]
  );

  // Get stores
  const storesRes = await query(
    `SELECT s.id, s.name, s.invite_code, s.status, s.address, s.created_at,
            (SELECT count(*)::int FROM store_staff ss WHERE ss.store_id = s.id) AS staff_count
     FROM stores s
     WHERE s.tenant_id = $1
     ORDER BY s.created_at DESC`,
    [tenantId]
  );

  return {
    ...tenant,
    owners: ownersRes.rows,
    stores: storesRes.rows,
  };
}

export async function createTenant({ name, slug, email, phone, address, status = 'ACTIVE' }, adminId) {
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  if (!trimmedName) {
    throw new ApiError(400, 'Tên tổ chức là bắt buộc.');
  }

  let finalSlug = slug ? slugify(slug) : slugify(trimmedName);
  if (!finalSlug) {
    finalSlug = `tenant-${Date.now().toString(36)}`;
  }

  // Check duplicate slug
  const duplicateCheck = await query(
    `SELECT 1 FROM tenants WHERE slug = $1 LIMIT 1`,
    [finalSlug]
  );

  if (duplicateCheck.rows.length > 0) {
    finalSlug = `${finalSlug}-${Math.floor(100 + Math.random() * 900)}`;
  }

  const result = await query(
    `INSERT INTO tenants (name, slug, email, phone, address, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now(), now())
     RETURNING id, name, slug, email, phone, address, status, created_at, updated_at`,
    [
      trimmedName,
      finalSlug,
      email ? email.trim().toLowerCase() : null,
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    ]
  );

  const createdTenant = result.rows[0];

  await logAdminAction({
    adminId,
    action: 'CREATE_TENANT',
    targetType: 'TENANT',
    targetId: createdTenant.id,
    details: { name: createdTenant.name, slug: createdTenant.slug },
  });

  return createdTenant;
}

export async function updateTenant(tenantId, data, adminId) {
  const { name, slug, email, phone, address, status } = data;

  const existingRes = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
  const existing = existingRes.rows[0];
  if (!existing) {
    throw new ApiError(404, 'Tổ chức không tồn tại.');
  }

  const updatedName = name !== undefined ? name.trim() : existing.name;
  let updatedSlug = existing.slug;

  if (slug && slug.trim() && slug.trim() !== existing.slug) {
    updatedSlug = slugify(slug);
    const dupCheck = await query(`SELECT 1 FROM tenants WHERE slug = $1 AND id <> $2`, [updatedSlug, tenantId]);
    if (dupCheck.rows.length > 0) {
      throw new ApiError(409, 'Mã tổ chức (slug) này đã tồn tại.');
    }
  }

  const updatedEmail = email !== undefined ? (email ? email.trim().toLowerCase() : null) : existing.email;
  const updatedPhone = phone !== undefined ? (phone ? phone.trim() : null) : existing.phone;
  const updatedAddress = address !== undefined ? (address ? address.trim() : null) : existing.address;
  const updatedStatus = status !== undefined ? (status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') : existing.status;

  const result = await query(
    `UPDATE tenants
     SET name = $1, slug = $2, email = $3, phone = $4, address = $5, status = $6, updated_at = now()
     WHERE id = $7
     RETURNING id, name, slug, email, phone, address, status, created_at, updated_at`,
    [updatedName, updatedSlug, updatedEmail, updatedPhone, updatedAddress, updatedStatus, tenantId]
  );

  await logAdminAction({
    adminId,
    action: 'UPDATE_TENANT',
    targetType: 'TENANT',
    targetId: tenantId,
    details: { name: updatedName, changes: data },
  });

  return result.rows[0];
}

export async function toggleTenantStatus(tenantId, nextStatus, adminId) {
  const statusValue = nextStatus === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

  const result = await query(
    `UPDATE tenants
     SET status = $1, updated_at = now()
     WHERE id = $2
     RETURNING id, name, slug, status, updated_at`,
    [statusValue, tenantId]
  );

  const updated = result.rows[0];
  if (!updated) {
    throw new ApiError(404, 'Không tìm thấy tổ chức.');
  }

  await logAdminAction({
    adminId,
    action: statusValue === 'ACTIVE' ? 'ACTIVATE_TENANT' : 'DEACTIVATE_TENANT',
    targetType: 'TENANT',
    targetId: tenantId,
    details: { name: updated.name, status: statusValue },
  });

  return updated;
}

export async function addTenantOwner(tenantId, { email, username, userId }, adminId) {
  let targetUser = null;
  if (userId) {
    const uRes = await query(`SELECT id, username, email, full_name, status FROM app_users WHERE id = $1 AND deleted_at IS NULL`, [userId]);
    targetUser = uRes.rows[0];
  } else if (email) {
    const uRes = await query(`SELECT id, username, email, full_name, status FROM app_users WHERE lower(email) = lower($1) AND deleted_at IS NULL`, [email.trim()]);
    targetUser = uRes.rows[0];
  } else if (username) {
    const uRes = await query(`SELECT id, username, email, full_name, status FROM app_users WHERE lower(username) = lower($1) AND deleted_at IS NULL`, [username.trim()]);
    targetUser = uRes.rows[0];
  }

  if (!targetUser) {
    throw new ApiError(404, 'Không tìm thấy tài khoản người dùng tương ứng.');
  }

  // Insert into tenant_owners
  await query(
    `INSERT INTO tenant_owners (user_id, tenant_id, joined_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id, tenant_id) DO NOTHING`,
    [targetUser.id, tenantId]
  );

  await logAdminAction({
    adminId,
    action: 'ADD_TENANT_OWNER',
    targetType: 'TENANT',
    targetId: tenantId,
    details: { userId: targetUser.id, username: targetUser.username },
  });

  return targetUser;
}

export async function removeTenantOwner(tenantId, userId, adminId) {
  await query(
    `DELETE FROM tenant_owners WHERE user_id = $1 AND tenant_id = $2`,
    [userId, tenantId]
  );

  await logAdminAction({
    adminId,
    action: 'REMOVE_TENANT_OWNER',
    targetType: 'TENANT',
    targetId: tenantId,
    details: { userId },
  });

  return { success: true };
}

export default {
  listTenants,
  getTenantById,
  createTenant,
  updateTenant,
  toggleTenantStatus,
  addTenantOwner,
  removeTenantOwner,
};
