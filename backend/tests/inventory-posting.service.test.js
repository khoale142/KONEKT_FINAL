import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}));

import { pool } from '../src/config/db.js';
import {
  postInventoryMovements,
  postInventoryMovementsAtomically,
} from '../src/modules/inventory/inventory-posting.service.js';

const STORE_ID = 'store-a';
const ACTOR_ID = 'actor-a';

function inventoryItem(id, quantity = '5') {
  return {
    id,
    store_id: STORE_ID,
    item_type: 'RAW_INGREDIENT',
    ingredient_id: `ingredient-${id}`,
    product_id: null,
    quantity_on_hand: quantity,
    inventory_value: null,
    current_unit_cost: null,
    cost_status: 'UNAVAILABLE',
    cost_version: 0,
    row_version: 0,
    product_inventory_mode: null,
    product_is_group: null,
    product_parent_product_id: null,
  };
}

function input(overrides = {}) {
  return {
    storeId: STORE_ID,
    actorId: ACTOR_ID,
    movements: [{
      inventoryItemId: 'item-a',
      postingKey: 'test:item-a:one',
      movementType: 'MANUAL_ADJUST',
      quantityDelta: '10',
    }],
    ...overrides,
  };
}

function movementRow(overrides = {}) {
  return {
    id: 'movement-a',
    store_id: STORE_ID,
    inventory_item_id: 'item-a',
    posting_key: 'test:item-a:one',
    movement_type: 'MANUAL_ADJUST',
    quantity_delta: '10',
    before_quantity: '5',
    after_quantity: '15',
    unit_cost_snapshot: null,
    value_delta: null,
    occurred_at: '2026-09-21T00:00:00.000Z',
    ...overrides,
  };
}

function readyClient({ lockedItems = [inventoryItem('item-a')], balanceRows = [{
  before_quantity: '5', after_quantity: '15', inventory_value: null,
  current_unit_cost: null, cost_status: 'UNAVAILABLE', cost_version: 0, row_version: 1,
}], insertedRows = [movementRow()] } = {}) {
  const client = { query: vi.fn() };
  client.query
    .mockResolvedValueOnce({ rows: [] }) // initial idempotency lookup
    .mockResolvedValueOnce({ rows: lockedItems }) // deterministic FOR UPDATE lock
    .mockResolvedValueOnce({ rows: [] }); // lookup after lock
  for (let index = 0; index < balanceRows.length; index += 1) {
    client.query.mockResolvedValueOnce({ rows: [balanceRows[index]] });
    client.query.mockResolvedValueOnce({ rows: [{ id: lockedItems[index].ingredient_id, current_stock: balanceRows[index].after_quantity }] });
    client.query.mockResolvedValueOnce({ rows: [insertedRows[index]] });
  }
  return client;
}

describe('InventoryPostingService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts a positive movement using database-calculated before/after quantities', async () => {
    const client = readyClient();
    const result = await postInventoryMovements(client, input());

    expect(result.alreadyPosted).toBe(false);
    expect(result.movements[0].before_quantity).toBe('5');
    expect(result.movements[0].after_quantity).toBe('15');
    expect(client.query.mock.calls[1][1][1]).toEqual(['item-a']);
  });

  it('supports signed negative movements when the locked update permits the result', async () => {
    const client = readyClient({
      lockedItems: [inventoryItem('item-a', '15')],
      balanceRows: [{
        before_quantity: '15', after_quantity: '12', inventory_value: null,
        current_unit_cost: null, cost_status: 'UNAVAILABLE', cost_version: 0, row_version: 1,
      }],
      insertedRows: [movementRow({ quantity_delta: '-3', before_quantity: '15', after_quantity: '12' })],
    });
    const result = await postInventoryMovements(client, input({ movements: [{
      inventoryItemId: 'item-a', postingKey: 'test:item-a:minus-three',
      movementType: 'MANUAL_ADJUST', quantityDelta: '-3',
    }] }));

    expect(result.movements[0].after_quantity).toBe('12');
  });

  it('rejects a negative balance without inserting a movement', async () => {
    const client = readyClient({ balanceRows: [] });
    client.query.mockResolvedValueOnce({ rows: [] }); // locked UPDATE returns no row

    await expect(postInventoryMovements(client, input({ movements: [{
      inventoryItemId: 'item-a', postingKey: 'test:item-a:blocked',
      movementType: 'MANUAL_ADJUST', quantityDelta: '-5',
    }] }))).rejects.toThrow('Posting would create a negative inventory balance.');
    expect(client.query).toHaveBeenCalledTimes(4);
  });

  it('fails the posting before movement insert when the compatibility mirror fails', async () => {
    const client = readyClient();
    client.query.mockReset()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [inventoryItem('item-a')] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ before_quantity: '5', after_quantity: '15', inventory_value: null, current_unit_cost: null, cost_status: 'UNAVAILABLE', cost_version: 0, row_version: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(postInventoryMovements(client, input())).rejects.toThrow('compatibility mirror target');
    expect(client.query).toHaveBeenCalledTimes(5);
  });

  it('returns an idempotent result without locking or mutating when every key already exists', async () => {
    const client = { query: vi.fn().mockResolvedValueOnce({ rows: [movementRow()] }) };
    const result = await postInventoryMovements(client, input());

    expect(result.alreadyPosted).toBe(true);
    expect(client.query).toHaveBeenCalledTimes(1);
  });

  it('locks a two-item request once in deterministic sorted order before applying both movements', async () => {
    const client = readyClient({
      lockedItems: [inventoryItem('item-a'), inventoryItem('item-b')],
      balanceRows: [
        { before_quantity: '5', after_quantity: '15', inventory_value: null, current_unit_cost: null, cost_status: 'UNAVAILABLE', cost_version: 0, row_version: 1 },
        { before_quantity: '2', after_quantity: '5', inventory_value: null, current_unit_cost: null, cost_status: 'UNAVAILABLE', cost_version: 0, row_version: 1 },
      ],
      insertedRows: [movementRow(), movementRow({ id: 'movement-b', inventory_item_id: 'item-b', posting_key: 'test:item-b:two', quantity_delta: '3', before_quantity: '2', after_quantity: '5' })],
    });
    const result = await postInventoryMovements(client, input({ movements: [
      { inventoryItemId: 'item-b', postingKey: 'test:item-b:two', movementType: 'MANUAL_ADJUST', quantityDelta: '3' },
      { inventoryItemId: 'item-a', postingKey: 'test:item-a:one', movementType: 'MANUAL_ADJUST', quantityDelta: '10' },
    ] }));

    expect(result.movements).toHaveLength(2);
    expect(client.query.mock.calls[1][1][1]).toEqual(['item-a', 'item-b']);
  });

  it('rolls back the convenience transaction boundary when a posting fails', async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    pool.connect.mockResolvedValueOnce(client);
    client.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockResolvedValueOnce({ rows: [] }) // existing posting keys
      .mockResolvedValueOnce({ rows: [inventoryItem('item-a')] }) // lock
      .mockResolvedValueOnce({ rows: [] }) // recheck
      .mockResolvedValueOnce({ rows: [] }) // rejected locked update
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(postInventoryMovementsAtomically(input({ movements: [{
      inventoryItemId: 'item-a', postingKey: 'test:item-a:rollback',
      movementType: 'MANUAL_ADJUST', quantityDelta: '-5',
    }] }))).rejects.toThrow('Posting would create a negative inventory balance.');
    expect(client.query.mock.calls.at(-1)[0]).toBe('rollback');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
