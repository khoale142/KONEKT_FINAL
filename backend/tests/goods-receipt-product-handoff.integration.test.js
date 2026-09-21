import { afterAll, describe, expect, it } from 'vitest';
import { pool } from '../src/config/db.js';
import { createGoodsReceiptDraft, submitGoodsReceipt, approveGoodsReceipt } from '../src/modules/inventory/goods-receipt.service.js';
import { createOrder, refundOrderItems } from '../src/modules/orders/order.service.js';

describe('Phase 6C normal Product receipt handoff (rollback-only)', () => {
  it('activates, sells, refunds, retries idempotently, and rolls back', async () => {
    process.stderr.write('TEST_START\n');
    const client = await pool.connect();
    const rawQuery = client.query.bind(client);
    const originalConnect = pool.connect.bind(pool);
    const originalQuery = pool.query.bind(pool);
    const originalRelease = client.release.bind(client);
    let fixture;
    await rawQuery('begin');
    try {
      const context = (await rawQuery("select ps.staff_id,ps.store_id,s.tenant_id from pos_sessions ps join stores s on s.id=ps.store_id where ps.status='OPEN' and ps.store_id is not null limit 1")).rows[0];
      expect(context).toBeTruthy();
      const product = (await rawQuery("insert into products(name,price,status,store_id,unit,created_by) values('Phase 6C handoff fixture',100,'ACTIVE',$1,'each',$2) returning id", [context.store_id, context.staff_id])).rows[0];
      const inventory = (await rawQuery("insert into inventory_items(store_id,item_type,product_id,quantity_on_hand,product_inventory_mode,current_unit_cost) values($1,'PRODUCT',$2,0,'RECIPE_ON_SALE',30) returning id", [context.store_id, product.id])).rows[0];
      const unit = (await rawQuery("insert into inventory_item_units(inventory_item_id,name,level,is_base,multiplier_to_parent,factor_to_base) values($1,'each',0,true,1,1) returning id", [inventory.id])).rows[0];
      fixture = { context, productId: product.id, inventoryId: inventory.id };
      client.query = async (text, params) => ['begin', 'commit'].includes(String(text).trim().toLowerCase()) ? { rows: [] } : rawQuery(text, params);
      pool.connect = async () => client; pool.query = (text, params) => client.query(text, params); client.release = () => {};
      const actor = { id: context.staff_id }; const workspace = { storeId: context.store_id, tenantId: context.tenant_id, role: 'MANAGER', isOwner: true };
      const draft = await createGoodsReceiptDraft({ lines: [{ inventoryItemId: inventory.id, purchaseUnitId: unit.id, enteredQuantity: 5, totalPurchaseValue: 50 }] }, actor, workspace);
      const documentId = (await rawQuery('select id from inventory_documents where document_number=$1', [draft.documentNumber])).rows[0].id;
      await submitGoodsReceipt(documentId, actor, workspace); await approveGoodsReceipt(documentId, {}, actor, workspace);
      process.stderr.write('RECEIPT_ASSERTIONS_DONE\n');
      expect((await rawQuery('select product_inventory_mode,quantity_on_hand::text q,inventory_value::text v,current_unit_cost::text c,stock_activated_at from inventory_items where id=$1', [inventory.id])).rows[0]).toMatchObject({ product_inventory_mode: 'STOCKED', q: '5', v: '50', c: '10' });
      const order = await createOrder({ items: [{ productId: product.id, quantity: 2 }], paymentMethod: 'CASH', amountReceived: 999 }, actor, context.store_id);
      const orderItem = (await rawQuery('select id,inventory_behavior_snapshot,inventory_snapshot_version from order_items where order_id=$1', [order.id])).rows[0];
      expect(orderItem).toMatchObject({ inventory_behavior_snapshot: 'STOCKED_PRODUCT', inventory_snapshot_version: 2 });
      process.stderr.write('SALE_ASSERTIONS_DONE\n');
      await refundOrderItems(order.id, { items: [{ orderItemId: orderItem.id, refundQuantity: 2 }], returnToStock: true, reason: 'test', operationId: '1ed962ee-5513-4211-b249-818e2d31c0c7' }, actor, context.store_id, { client });
      await refundOrderItems(order.id, { items: [{ orderItemId: orderItem.id, refundQuantity: 2 }], returnToStock: true, reason: 'test', operationId: '1ed962ee-5513-4211-b249-818e2d31c0c7' }, actor, context.store_id, { client });
      expect((await rawQuery("select quantity_on_hand::text q,inventory_value::text v,(select count(*)::int from inventory_movements where inventory_item_id=$1 and movement_type='REFUND_IN') refunds from inventory_items where id=$1", [inventory.id])).rows[0]).toEqual({ q: '5', v: '50', refunds: 1 });
      process.stderr.write('REFUND_ASSERTIONS_DONE\n');
    } finally {
      await rawQuery('rollback'); client.query = rawQuery; client.release = originalRelease; pool.connect = originalConnect; pool.query = originalQuery; originalRelease();
      process.stderr.write('ROLLBACK_DONE\n');
    }
    expect((await pool.query('select count(*)::int as count from products where id=$1', [fixture.productId])).rows[0].count).toBe(0);
    process.stderr.write('POST_ROLLBACK_ASSERTIONS_DONE\n');
  }, 30000);
});

afterAll(async () => { process.stderr.write('AFTER_ALL_START\n'); await pool.end(); process.stderr.write('AFTER_ALL_DONE\n'); });
