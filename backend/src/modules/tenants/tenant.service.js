import { pool, query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '') + '-' + Math.floor(Math.random() * 1000);
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createTenant(userId, { name, email, phone, address }) {
  const normalizedName = normalizeString(name);
  const normalizedEmail = normalizeString(email);
  const normalizedPhone = normalizeString(phone);
  const normalizedAddress = normalizeString(address);

  if (!normalizedName) {
    throw new ApiError(400, 'Tenant name is required.');
  }

  const slug = generateSlug(normalizedName);
  const client = await pool.connect();

  try {
    await client.query('begin');

    // 1. Create tenant
    const tenantResult = await client.query(
      `insert into tenants (name, slug, email, phone, address)
       values ($1, $2, $3, $4, $5)
       returning id, name, slug, email, phone, address, status, created_at`,
      [normalizedName, slug, normalizedEmail, normalizedPhone, normalizedAddress]
    );
    const tenant = tenantResult.rows[0];

    // 2. Add user to tenant_owners
    await client.query(
      `insert into tenant_owners (user_id, tenant_id)
       values ($1, $2)`,
      [userId, tenant.id]
    );

    // 3. Create default store
    let inviteCode = generateInviteCode();
    let codeIsUnique = false;
    
    // Ensure unique invite code
    while (!codeIsUnique) {
      const checkResult = await client.query(`select 1 from stores where invite_code = $1`, [inviteCode]);
      if (checkResult.rows.length === 0) {
        codeIsUnique = true;
      } else {
        inviteCode = generateInviteCode();
      }
    }

    const storeResult = await client.query(
      `insert into stores (tenant_id, name, address, invite_code)
       values ($1, $2, $3, $4)
       returning id, name, address, invite_code, status`,
      [tenant.id, 'Chi nhánh chính', normalizedAddress, inviteCode]
    );
    const store = storeResult.rows[0];

    // 4. Create sample data for the first store
    // Sample Ingredient
    const ingredientResult = await client.query(
      `insert into ingredients (name, tag, unit, current_stock, low_stock_threshold, created_by, store_id)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      ['Cà phê hạt xay', 'Cà phê', 'Gram', 1000, 200, userId, store.id]
    );
    const ingredientId = ingredientResult.rows[0].id;
    
    // Sample Product
    const productResult = await client.query(
      `insert into products (name, tag, price, status, created_by, store_id)
       values ($1, $2, $3, $4, $5, $6)
       returning id`,
      ['Cà phê đen đá', 'Cà phê', 25000, 'ACTIVE', userId, store.id]
    );
    const productId = productResult.rows[0].id;
    
    // Sample Recipe
    const recipeResult = await client.query(
      `insert into recipes (product_id, store_id)
       values ($1, $2)
       returning id`,
      [productId, store.id]
    );
    const recipeId = recipeResult.rows[0].id;
    
    // Sample Recipe Item
    await client.query(
      `insert into recipe_items (recipe_id, ingredient_id, quantity_required)
       values ($1, $2, $3)`,
      [recipeId, ingredientId, 25] // 25g coffee per cup
    );
    
    // Sample Shift
    await client.query(
      `insert into shifts (name, start_time, end_time, status, store_id)
       values ($1, $2, $3, $4, $5)`,
      ['Ca Sáng', '07:00:00', '15:00:00', 'ACTIVE', store.id]
    );

    await client.query('commit');

    return {
      ...tenant,
      stores: [store],
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function getMyTenants(userId) {
  const result = await query(
    `select t.id, t.name, t.slug, t.status, t.created_at
     from tenants t
     join tenant_owners to_owner on to_owner.tenant_id = t.id
     where to_owner.user_id = $1 and t.status = 'ACTIVE'
     order by t.created_at desc`,
    [userId]
  );
  
  return result.rows;
}

export async function getTenantDetail(tenantId) {
  const tenantResult = await query(
    `select id, name, slug, status, created_at
     from tenants
     where id = $1 limit 1`,
    [tenantId]
  );

  if (!tenantResult.rows[0]) {
    throw new ApiError(404, 'Tenant not found.');
  }

  const tenant = tenantResult.rows[0];

  const storesResult = await query(
    `select id, name, address, invite_code, status, created_at
     from stores
     where tenant_id = $1
     order by created_at asc`,
    [tenantId]
  );

  return {
    ...tenant,
    stores: storesResult.rows,
  };
}
