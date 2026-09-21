import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool, query } from '../config/db.js';

dotenv.config();

const users = [
  {
    username: 'admin',
    email: 'admin@minicoffee.local',
    password: 'Admin123@',
    fullName: 'Admin Demo',
  },
  {
    username: 'staff',
    email: 'staff@minicoffee.local',
    password: 'Staff123@',
    fullName: 'Staff Demo',
  },
];

const ingredients = [
  { name: 'Coffee bean', unit: 'GRAM', currentStock: 1000, lowStockThreshold: 100 },
  { name: 'Milk', unit: 'ML', currentStock: 1000, lowStockThreshold: 100 },
  { name: 'Sugar', unit: 'GRAM', currentStock: 50, lowStockThreshold: 100 },
];

const products = [
  { name: 'Milk Coffee', price: 30000, status: 'ACTIVE' },
  { name: 'Black Coffee', price: 25000, status: 'ACTIVE' },
  { name: 'Inactive Test Product', price: 20000, status: 'INACTIVE' },
  { name: 'No Recipe Product', price: 20000, status: 'ACTIVE' },
];

const recipeDefinitions = {
  'Milk Coffee': [
    { ingredientName: 'Coffee bean', quantityRequired: 20 },
    { ingredientName: 'Milk', quantityRequired: 100 },
    { ingredientName: 'Sugar', quantityRequired: 10 },
  ],
  'Black Coffee': [
    { ingredientName: 'Coffee bean', quantityRequired: 20 },
    { ingredientName: 'Sugar', quantityRequired: 5 },
  ],
};

const defaultShifts = [
  { name: 'Ca Sáng', startTime: '06:00:00', endTime: '12:00:00', hourlyRate: 25000 },
  { name: 'Ca Chiều', startTime: '12:00:00', endTime: '18:00:00', hourlyRate: 25000 },
  { name: 'Ca Tối', startTime: '18:00:00', endTime: '23:00:00', hourlyRate: 30000 },
];

async function upsertUser(user) {
  const passwordHash = await bcrypt.hash(user.password, 10);
  const result = await query(
    `insert into app_users (username, email, password_hash, full_name, status)
     values ($1, $2, $3, $4, 'ACTIVE')
     on conflict (username)
     do update set
       email = excluded.email,
       password_hash = excluded.password_hash,
       full_name = excluded.full_name,
       status = 'ACTIVE',
       deleted_at = null,
       updated_at = now()
     returning id, username`,
    [user.username, user.email, passwordHash, user.fullName],
  );

  return result.rows[0];
}

async function upsertTenant(name, slug) {
  const result = await query(
    `insert into tenants (name, slug)
     values ($1, $2)
     on conflict (slug)
     do update set name = excluded.name, updated_at = now()
     returning id, name, slug`,
    [name, slug],
  );
  return result.rows[0];
}

async function upsertTenantOwner(userId, tenantId) {
  await query(
    `insert into tenant_owners (user_id, tenant_id)
     values ($1, $2)
     on conflict do nothing`,
    [userId, tenantId],
  );
}

async function upsertStore(tenantId, name, inviteCode) {
  const result = await query(
    `insert into stores (tenant_id, name, invite_code)
     values ($1, $2, $3)
     on conflict (invite_code)
     do update set name = excluded.name, tenant_id = excluded.tenant_id, updated_at = now()
     returning id, tenant_id, name, invite_code`,
    [tenantId, name, inviteCode],
  );
  return result.rows[0];
}

async function upsertStoreStaff(userId, storeId) {
  await query(
    `insert into store_staff (user_id, store_id)
     values ($1, $2)
     on conflict do nothing`,
    [userId, storeId],
  );
}

async function upsertIngredient(ingredient, createdBy, storeId) {
  const result = await query(
    `insert into ingredients (name, unit, current_stock, low_stock_threshold, created_by, store_id)
     values ($1, $2, $3, $4, $5, $6)
     returning id, name`,
    [ingredient.name, ingredient.unit, ingredient.currentStock, ingredient.lowStockThreshold, createdBy, storeId],
  );

  return result.rows[0];
}

async function upsertProduct(product, createdBy, storeId) {
  const result = await query(
    `insert into products (name, price, status, created_by, store_id)
     values ($1, $2, $3, $4, $5)
     returning id, name`,
    [product.name, product.price, product.status, createdBy, storeId],
  );

  return result.rows[0];
}

async function upsertRecipe(productId, createdBy, storeId) {
  const result = await query(
    `insert into recipes (product_id, created_by, store_id)
     values ($1, $2, $3)
     returning id`,
    [productId, createdBy, storeId],
  );

  return result.rows[0];
}

async function replaceRecipeItems(recipeId, items, ingredientMap) {
  await query('delete from recipe_items where recipe_id = $1', [recipeId]);

  for (const item of items) {
    const ingredient = ingredientMap.get(item.ingredientName);

    if (!ingredient) {
      throw new Error(`Missing ingredient for recipe seed: ${item.ingredientName}`);
    }

    await query(
      `insert into recipe_items (recipe_id, ingredient_id, quantity_required)
       values ($1, $2, $3)`,
      [recipeId, ingredient.id, item.quantityRequired],
    );
  }
}

async function seed() {
  console.log('Seeding Mini Coffee demo data...');

  // 1. Create users
  const admin = await upsertUser(users[0]);
  const staff = await upsertUser(users[1]);

  // 2. Create tenant & owner mapping
  const tenant = await upsertTenant('Mini Coffee Demo', 'mini-coffee-demo');
  await upsertTenantOwner(admin.id, tenant.id);

  // 3. Create store & staff mapping
  const store = await upsertStore(tenant.id, 'Chi nhánh chính', 'SEED-STORE-001');
  await upsertStoreStaff(staff.id, store.id);

  // Clear existing store data if any (for idempotency within store)
  await query(`delete from recipe_items where recipe_id in (select id from recipes where store_id = $1)`, [store.id]);
  await query(`delete from recipes where store_id = $1`, [store.id]);
  await query(`delete from products where store_id = $1`, [store.id]);
  await query(`delete from ingredients where store_id = $1`, [store.id]);
  await query(`delete from shifts where store_id = $1`, [store.id]);

  // 4. Seed ingredients
  const ingredientMap = new Map();
  for (const ingredient of ingredients) {
    const row = await upsertIngredient(ingredient, admin.id, store.id);
    ingredientMap.set(row.name, row);
  }

  // 5. Seed products & recipes
  const productMap = new Map();
  for (const product of products) {
    const row = await upsertProduct(product, admin.id, store.id);
    productMap.set(row.name, row);
  }

  for (const [productName, items] of Object.entries(recipeDefinitions)) {
    const product = productMap.get(productName);
    const recipe = await upsertRecipe(product.id, admin.id, store.id);
    await replaceRecipeItems(recipe.id, items, ingredientMap);
  }

  // 6. Seed default shifts
  console.log('Seeding default shifts...');
  for (const shift of defaultShifts) {
    await query(
      `insert into shifts (name, start_time, end_time, hourly_rate, store_id)
       values ($1, $2, $3, $4, $5)`,
      [shift.name, shift.startTime, shift.endTime, shift.hourlyRate, store.id]
    );
  }

  console.log('Seed completed.');
  console.log('Admin login: admin / Admin123@ (Owner of Tenant)');
  console.log('Staff login: staff / Staff123@ (Staff of Store)');
}

try {
  await seed();
} catch (error) {
  console.error('Seed failed:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
