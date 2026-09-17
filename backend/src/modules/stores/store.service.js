import { pool, query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createStore(tenantId, { name, address }, sourceStoreId) {
  const normalizedName = normalizeString(name);
  const normalizedAddress = normalizeString(address);

  if (!normalizedName) {
    throw new ApiError(400, 'Store name is required.');
  }

  const client = await pool.connect();

  try {
    await client.query('begin');

    let inviteCode = generateInviteCode();
    let codeIsUnique = false;
    
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
      [tenantId, normalizedName, normalizedAddress, inviteCode]
    );
    const newStore = storeResult.rows[0];

    // Clone data from source store if provided
    if (sourceStoreId) {
      // Clone products
      await client.query(
        `insert into products (name, tag, price, status, image_url, created_by, store_id)
         select name, tag, price, status, image_url, created_by, $2
         from products where store_id = $1 and deleted_at is null`,
        [sourceStoreId, newStore.id]
      );
      
      // We need a mapping of old product ids to new product ids for recipes.
      const oldProducts = await client.query(`select id, name from products where store_id = $1 and deleted_at is null`, [sourceStoreId]);
      const newProducts = await client.query(`select id, name from products where store_id = $1 and deleted_at is null`, [newStore.id]);
      const productIdMap = new Map();
      
      for (const oldP of oldProducts.rows) {
        const newP = newProducts.rows.find(p => p.name === oldP.name);
        if (newP) {
          productIdMap.set(oldP.id, newP.id);
        }
      }

      // Clone ingredients (with current_stock = 0)
      await client.query(
        `insert into ingredients (name, tag, unit, current_stock, low_stock_threshold, created_by, store_id)
         select name, tag, unit, 0, low_stock_threshold, created_by, $2
         from ingredients where store_id = $1 and deleted_at is null`,
        [sourceStoreId, newStore.id]
      );
      
      const oldIngredients = await client.query(`select id, name from ingredients where store_id = $1 and deleted_at is null`, [sourceStoreId]);
      const newIngredients = await client.query(`select id, name from ingredients where store_id = $1 and deleted_at is null`, [newStore.id]);
      const ingredientIdMap = new Map();
      
      for (const oldI of oldIngredients.rows) {
        const newI = newIngredients.rows.find(i => i.name === oldI.name);
        if (newI) {
          ingredientIdMap.set(oldI.id, newI.id);
        }
      }

      // Clone recipes
      const oldRecipes = await client.query(`select id, product_id from recipes where store_id = $1 and deleted_at is null`, [sourceStoreId]);
      
      for (const oldR of oldRecipes.rows) {
        const newProductId = productIdMap.get(oldR.product_id);
        if (newProductId) {
          const recipeResult = await client.query(
            `insert into recipes (product_id, store_id) values ($1, $2) returning id`,
            [newProductId, newStore.id]
          );
          const newRecipeId = recipeResult.rows[0].id;
          
          // Clone recipe items
          const recipeItems = await client.query(`select ingredient_id, quantity_required from recipe_items where recipe_id = $1`, [oldR.id]);
          
          for (const item of recipeItems.rows) {
            const newIngredientId = ingredientIdMap.get(item.ingredient_id);
            if (newIngredientId) {
              await client.query(
                `insert into recipe_items (recipe_id, ingredient_id, quantity_required) values ($1, $2, $3)`,
                [newRecipeId, newIngredientId, item.quantity_required]
              );
            }
          }
        }
      }
      
      // Clone shifts
      await client.query(
        `insert into shifts (name, start_time, end_time, status, store_id)
         select name, start_time, end_time, status, $2
         from shifts where store_id = $1`,
        [sourceStoreId, newStore.id]
      );
    }

    await client.query('commit');

    return newStore;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function joinStoreByInviteCode(userId, inviteCode) {
  const normalizedCode = normalizeString(inviteCode).toUpperCase();
  
  if (!normalizedCode) {
    throw new ApiError(400, 'Invite code is required.');
  }

  const storeResult = await query(
    `select s.id, s.tenant_id, s.name, s.status, t.status as tenant_status
     from stores s
     join tenants t on t.id = s.tenant_id
     where s.invite_code = $1 limit 1`,
    [normalizedCode]
  );

  const store = storeResult.rows[0];

  if (!store) {
    throw new ApiError(404, 'Invalid invite code.');
  }

  if (store.status !== 'ACTIVE' || store.tenant_status !== 'ACTIVE') {
    throw new ApiError(403, 'This store is inactive.');
  }

  const checkStaff = await query(
    `select 1 from store_staff where user_id = $1 and store_id = $2`,
    [userId, store.id]
  );

  if (checkStaff.rows[0]) {
    throw new ApiError(409, 'You are already a staff member of this store.');
  }
  
  // Do not allow owner to join as staff
  const checkOwner = await query(
    `select 1 from tenant_owners where user_id = $1 and tenant_id = $2`,
    [userId, store.tenant_id]
  );
  
  if (checkOwner.rows[0]) {
    throw new ApiError(409, 'You are already the owner of the tenant that owns this store.');
  }

  await query(
    `insert into store_staff (user_id, store_id) values ($1, $2)`,
    [userId, store.id]
  );

  return {
    id: store.id,
    name: store.name,
    tenantId: store.tenant_id,
  };
}

export async function regenerateInviteCode(storeId) {
  let inviteCode = generateInviteCode();
  let codeIsUnique = false;
  
  while (!codeIsUnique) {
    const checkResult = await query(`select 1 from stores where invite_code = $1`, [inviteCode]);
    if (checkResult.rows.length === 0) {
      codeIsUnique = true;
    } else {
      inviteCode = generateInviteCode();
    }
  }

  await query(
    `update stores set invite_code = $1, updated_at = now() where id = $2`,
    [inviteCode, storeId]
  );

  return { inviteCode };
}

export async function listStoreStaff(storeId) {
  const result = await query(
    `select u.id, u.username, u.full_name, u.email, ss.joined_at
     from store_staff ss
     join app_users u on u.id = ss.user_id
     where ss.store_id = $1
     order by ss.joined_at desc`,
    [storeId]
  );

  return result.rows;
}
