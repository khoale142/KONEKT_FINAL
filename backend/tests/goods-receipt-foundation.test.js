import { describe,it,expect } from 'vitest';
import { calculateGoodsReceiptValuation } from '../src/modules/inventory/goods-receipt.service.js';
import { readFile } from 'node:fs/promises';
describe('Goods Receipt valuation foundation',()=>{
 it('calculates first receipt and normal WAC',()=>{expect(calculateGoodsReceiptValuation({existingQuantity:'0',inventoryValue:null,currentUnitCost:null,baseQuantity:'10',purchaseValue:'100000'}).resultingUnitCost).toBe('10000');expect(calculateGoodsReceiptValuation({existingQuantity:'2',inventoryValue:'20000',currentUnitCost:'10000',baseQuantity:'8',purchaseValue:'96000'}).resultingUnitCost).toBe('11600');});
 it('requires and records bootstrap valuation',()=>{expect(()=>calculateGoodsReceiptValuation({existingQuantity:'20',inventoryValue:null,currentUnitCost:null,baseQuantity:'10',purchaseValue:'1000000'})).toThrow('Initial inventory valuation');expect(calculateGoodsReceiptValuation({existingQuantity:'20',inventoryValue:null,currentUnitCost:null,baseQuantity:'10',purchaseValue:'1000000',initialValuationConfirmed:true})).toMatchObject({initialValuationValue:'2000000',resultingInventoryValue:'3000000',resultingUnitCost:'100000'});});
});

it('keeps receipt conversion snapshots nullable until submission',async()=>{
 const sql=await readFile(new URL('../src/seed/run_inventory_phase6_goods_receipt_migration.js',import.meta.url),'utf8');
 expect(sql).toContain('entered_unit_name_snapshot text,');
 expect(sql).toContain('conversion_path_snapshot jsonb,');
});
