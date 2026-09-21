import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}));

import { insertOrderItems, refundOrderItems } from '../src/modules/orders/order.service.js';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const STORE_ID = '33333333-3333-4333-8333-333333333333';

function orderItem(inventoryBehavior) {
  return {
    productId: PRODUCT_ID,
    productNameSnapshot: 'Phase 6B mapping test product',
    quantity: 2,
    unitPrice: 25,
    subtotal: 50,
    inventoryBehavior,
  };
}

describe('order item Phase 6B snapshot insert mapping', () => {
  for (const inventoryBehavior of ['STOCKED_PRODUCT', 'RECIPE_ON_SALE', 'NONE']) {
    it(`persists ${inventoryBehavior}, snapshot version 2, and the actual Store UUID in their matching columns`, async () => {
      const client = {
        query: vi.fn().mockResolvedValue({ rows: [{ id: 'order-item-id' }] }),
      };

      await insertOrderItems(client, ORDER_ID, [orderItem(inventoryBehavior)], STORE_ID);

      const [sql, params] = client.query.mock.calls[0];
      expect(sql).toContain('inventory_behavior_snapshot, inventory_snapshot_version, store_id');
      expect(sql).toContain('values ($1, $2, $3, $4, $5, $6, now(), $7, $8, $9)');
      expect(params).toEqual([
        ORDER_ID,
        PRODUCT_ID,
        'Phase 6B mapping test product',
        2,
        25,
        50,
        inventoryBehavior,
        2,
        STORE_ID,
      ]);
    });
  }
});

describe('Phase 6B refund operation identity', () => {
  it('rejects a new refund that has no client-generated operationId', async () => {
    await expect(refundOrderItems(ORDER_ID, { reason: 'test' }, { id: 'actor-id' }, STORE_ID))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('operationId is required') });
  });
});
