import crypto from 'crypto';
import { pool, query } from '../../config/db.js';
import { ApiError } from '../../utils/ApiError.js';
import { allocateDocumentNumber } from './inventory-document-number.service.js';
import { registerDocumentValidator, registerSubmissionSnapshotExtension } from './inventory-document-validation.service.js';
import { convertToBase, inventoryBaseUnitRequiredError } from './inventory-unit-conversion.service.js';
import { addDecimal, compareDecimal, divideDecimal, multiplyDecimal, requireNonNegativeDecimal, requirePositiveDecimal } from './inventory-decimal.js';
import { approveDocumentWithPosting, buildDocumentSubmissionSnapshot, hashDocumentSubmissionSnapshot } from './inventory-document.service.js';
import { postInventoryMovements } from './inventory-posting.service.js';
import { recalculateDependentRecipeCosts } from './inventory-recipe-cost.service.js';

const EDITABLE = new Set(['DRAFT', 'REJECTED']);
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const requiredActor = (actor) => clean(actor?.id) || (() => { throw new ApiError(401, 'Actor is required.'); })();
const receiptError = (status, code, message = code) => { const error = new ApiError(status, message, [{ code }]); error.code = code; return error; };
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const hash = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');

export function calculateGoodsReceiptValuation({ existingQuantity, inventoryValue, currentUnitCost, baseQuantity, purchaseValue, initialValuationConfirmed = false }) {
  const oldQuantity = requireNonNegativeDecimal(existingQuantity, 'Existing quantity');
  const received = requirePositiveDecimal(baseQuantity, 'Received quantity');
  const spend = requireNonNegativeDecimal(purchaseValue, 'Purchase value');
  if (compareDecimal(oldQuantity, '0') < 0) throw new ApiError(409, 'NEGATIVE_INVENTORY_RECONCILIATION_REQUIRED');
  const incoming = divideDecimal(spend, received);
  const unknown = inventoryValue === null || inventoryValue === undefined || currentUnitCost === null || currentUnitCost === undefined;
  if (compareDecimal(oldQuantity, '0') > 0 && unknown && !initialValuationConfirmed) {
    const error = new ApiError(409, 'Initial inventory valuation confirmation is required.', [{ code: 'INITIAL_INVENTORY_VALUATION_REQUIRED' }]); error.code = 'INITIAL_INVENTORY_VALUATION_REQUIRED'; throw error;
  }
  const initial = compareDecimal(oldQuantity, '0') > 0 && unknown ? multiplyDecimal(oldQuantity, incoming) : '0';
  const oldValue = initial === '0' ? (compareDecimal(oldQuantity, '0') === 0 ? '0' : requireNonNegativeDecimal(inventoryValue, 'Inventory value')) : initial;
  const quantity = addDecimal(oldQuantity, received); const value = addDecimal(oldValue, spend);
  return { baseQuantity: received, purchaseValue: spend, incomingUnitCost: incoming, initialValuationApplied: initial !== '0', initialExistingQuantity: initial !== '0' ? oldQuantity : null, initialValuationValue: initial !== '0' ? initial : null, resultingQuantity: quantity, resultingInventoryValue: value, resultingUnitCost: divideDecimal(value, quantity) };
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) throw receiptError(400, 'GOODS_RECEIPT_LINES_REQUIRED', 'A Goods Receipt requires at least one line.');
  const ids = new Set();
  return lines.map((line, index) => {
    const inventoryItemId = clean(line?.inventoryItemId ?? line?.inventory_item_id);
    const purchaseUnitId = clean(line?.purchaseUnitId ?? line?.purchase_unit_id ?? line?.enteredUnitId ?? line?.entered_unit_id);
    if (!inventoryItemId || !purchaseUnitId) throw receiptError(400, 'GOODS_RECEIPT_LINE_FIELDS_REQUIRED', `Line ${index + 1} requires an inventory item and purchase unit.`);
    if (ids.has(inventoryItemId)) throw receiptError(409, 'GOODS_RECEIPT_DUPLICATE_ITEM', 'Each inventory item may appear only once on a Goods Receipt.');
    ids.add(inventoryItemId);
    return { inventoryItemId, purchaseUnitId, enteredQuantity: requirePositiveDecimal(line.enteredQuantity ?? line.entered_quantity, 'Entered quantity'), totalPurchaseValue: requireNonNegativeDecimal(line.totalPurchaseValue ?? line.total_purchase_value, 'Purchase value'), note: clean(line.note) || null, lineNumber: index + 1 };
  });
}

async function addEvent(client, { documentId, actorId, type, fromStatus = null, toStatus = null, revision, reason = null, contentHash = null, payload = {} }) {
  await client.query(`insert into inventory_document_events(document_id,event_type,actor_id,from_status,to_status,document_revision,reason,content_hash,event_payload)
    values($1,$2::inventory_document_event_type,$3,$4::inventory_document_status,$5::inventory_document_status,$6,$7,$8,$9::jsonb)`, [documentId, type, actorId, fromStatus, toStatus, revision, reason, contentHash, JSON.stringify(payload)]);
}
async function lockedDocument(client, id, storeId) {
  const result = await client.query(`select * from inventory_documents where id=$1 and store_id=$2 and document_type='GOODS_RECEIPT' for update`, [id, storeId]);
  if (!result.rows[0]) throw new ApiError(404, 'Goods Receipt not found.'); return result.rows[0];
}
async function receiptItem(client, inventoryItemId, storeId) {
  const result = await client.query(`select ii.id,ii.store_id,ii.item_type,ii.ingredient_id,ii.product_id,ii.quantity_on_hand,ii.inventory_value,ii.current_unit_cost,ii.storage_location_id,i.name,i.deleted_at,i.is_preparation,p.name as product_name,p.deleted_at as product_deleted_at,p.status as product_status,p.is_group as product_is_group,sl.name as storage_location_name
    from inventory_items ii left join ingredients i on i.id=ii.ingredient_id and i.store_id=ii.store_id left join products p on p.id=ii.product_id and p.store_id=ii.store_id left join storage_locations sl on sl.id=ii.storage_location_id and sl.store_id=ii.store_id where ii.id=$1 and ii.store_id=$2`, [inventoryItemId, storeId]);
  const item = result.rows[0];
  if (!item) throw receiptError(404, 'GOODS_RECEIPT_ITEM_NOT_IN_STORE', 'Inventory item is not available in this Store.');
  if (item.item_type === 'PRODUCT') { if (!item.product_id || !item.product_name || item.product_deleted_at || item.product_status !== 'ACTIVE' || item.product_is_group) throw receiptError(409, 'GOODS_RECEIPT_PRODUCT_NOT_ELIGIBLE', 'Goods Receipt Product must be an active sellable Product or variant.'); return { ...item, name: item.product_name }; }
  if (item.item_type === 'PREPARATION' || item.is_preparation) throw receiptError(409, 'GOODS_RECEIPT_PREPARATION_NOT_ALLOWED', 'Preparation Goods Receipt is not allowed.');
  if (item.item_type !== 'RAW_INGREDIENT') throw receiptError(409, 'GOODS_RECEIPT_RAW_ONLY', 'Goods Receipt accepts Raw Ingredients only.');
  if (!item.name || item.deleted_at) throw receiptError(409, 'GOODS_RECEIPT_ITEM_INACTIVE', 'Goods Receipt item must be active.');
  return item;
}
async function validateLine(client, line, storeId) {
  const item = await receiptItem(client, line.inventoryItemId, storeId);
  const conversion = await convertToBase({ inventoryItemId: line.inventoryItemId, unitId: line.purchaseUnitId, quantity: line.enteredQuantity, storeId, client });
  if (!conversion.baseUnit?.id) throw inventoryBaseUnitRequiredError();
  return { ...line, item, conversion, incomingUnitCost: divideDecimal(line.totalPurchaseValue, conversion.baseQuantity) };
}
async function insertTypedLines(client, document, lines) {
  for (const line of lines) {
    const verified = await validateLine(client, line, document.store_id);
    const inserted = await client.query(`insert into inventory_document_items(document_id,store_id,line_number,inventory_item_id,item_role,note) values($1,$2,$3,$4,'PRIMARY',$5) returning id`, [document.id, document.store_id, line.lineNumber, line.inventoryItemId, line.note]);
    await client.query(`insert into inventory_receipt_line_details(document_item_id,entered_quantity,entered_unit_id,total_purchase_value) values($1,$2::numeric,$3,$4::numeric)`, [inserted.rows[0].id, verified.enteredQuantity, verified.purchaseUnitId, verified.totalPurchaseValue]);
  }
}
async function deleteTypedLines(client, documentId) {
  await client.query(`delete from inventory_receipt_line_details where document_item_id in (select id from inventory_document_items where document_id=$1)`, [documentId]);
  await client.query(`delete from inventory_document_items where document_id=$1`, [documentId]);
}
async function loadReceiptLines(client, documentId) {
  return (await client.query(`select di.id as document_item_id,di.line_number,di.inventory_item_id,di.item_role,di.note,di.item_name_snapshot,di.base_unit_snapshot,di.storage_location_name_snapshot,rd.entered_quantity,rd.entered_unit_id,rd.entered_unit_name_snapshot,rd.conversion_factor_to_base_snapshot,rd.conversion_path_snapshot,rd.converted_base_quantity,rd.total_purchase_value,rd.derived_incoming_unit_cost,rd.initial_valuation_applied,rd.initial_existing_quantity_snapshot,rd.initial_valuation_unit_cost_snapshot,rd.initial_valuation_value_snapshot,rd.resulting_quantity_snapshot,rd.resulting_inventory_value_snapshot,rd.resulting_unit_cost_snapshot,ii.quantity_on_hand,ii.inventory_value,ii.current_unit_cost,ii.store_id,ii.item_type,i.name as current_item_name,i.deleted_at,i.is_preparation,sl.name as current_location_name,eu.name as current_purchase_unit_name,bu.name as current_base_unit_name
    from inventory_document_items di join inventory_receipt_line_details rd on rd.document_item_id=di.id join inventory_items ii on ii.id=di.inventory_item_id and ii.store_id=di.store_id left join ingredients i on i.id=ii.ingredient_id and i.store_id=ii.store_id left join storage_locations sl on sl.id=ii.storage_location_id and sl.store_id=ii.store_id left join inventory_item_units eu on eu.id=rd.entered_unit_id and eu.inventory_item_id=ii.id left join inventory_item_units bu on bu.inventory_item_id=ii.id and bu.is_base and bu.is_active where di.document_id=$1 order by di.line_number`, [documentId])).rows;
}
function payloadLine(line) { return { documentItemId: line.document_item_id, inventoryItemId: line.inventory_item_id, enteredQuantity: String(line.entered_quantity), purchaseUnitId: line.entered_unit_id, purchaseUnitName: line.entered_unit_name_snapshot, factorToBase: String(line.conversion_factor_to_base_snapshot), conversionPath: line.conversion_path_snapshot, convertedBaseQuantity: String(line.converted_base_quantity), purchaseValue: String(line.total_purchase_value), incomingUnitCost: String(line.derived_incoming_unit_cost), note: line.note || null }; }
export function buildGoodsReceiptSubmissionSnapshot(document, lines) { return { documentNumber: document.document_number, documentType: 'GOODS_RECEIPT', revision: document.revision, note: document.note || null, effectiveAt: document.effective_at || null, receiptLines: lines.map(payloadLine) }; }
export function hashGoodsReceiptSubmissionSnapshot(document, lines) { return hash(buildGoodsReceiptSubmissionSnapshot(document, lines)); }
async function frozenLines(client, document, rawLines) {
  if (!rawLines.length) throw receiptError(400, 'GOODS_RECEIPT_LINES_REQUIRED', 'A Goods Receipt requires at least one line.');
  const seen = new Set(); const result = [];
  for (const raw of rawLines) {
    if (seen.has(raw.inventory_item_id)) throw receiptError(409, 'GOODS_RECEIPT_DUPLICATE_ITEM', 'Each inventory item may appear only once on a Goods Receipt.'); seen.add(raw.inventory_item_id);
    const line = { inventoryItemId: raw.inventory_item_id, purchaseUnitId: raw.entered_unit_id, enteredQuantity: raw.entered_quantity, totalPurchaseValue: raw.total_purchase_value, note: raw.note, lineNumber: raw.line_number };
    const verified = await validateLine(client, line, document.store_id);
    await client.query(`update inventory_document_items set item_name_snapshot=$1,base_unit_snapshot=$2,storage_location_name_snapshot=$3,base_quantity=$4::numeric,updated_at=now() where id=$5`, [verified.item.name, verified.conversion.baseUnit.name, verified.item.storage_location_name || null, verified.conversion.baseQuantity, raw.document_item_id]);
    await client.query(`update inventory_receipt_line_details set entered_quantity=$1::numeric,entered_unit_id=$2,entered_unit_name_snapshot=$3,conversion_factor_to_base_snapshot=$4::numeric,conversion_path_snapshot=$5::jsonb,converted_base_quantity=$6::numeric,total_purchase_value=$7::numeric,derived_incoming_unit_cost=$8::numeric,updated_at=now() where document_item_id=$9`, [verified.enteredQuantity, verified.purchaseUnitId, verified.conversion.enteredUnit.name, verified.conversion.factorToBase, JSON.stringify(verified.conversion.conversionPath), verified.conversion.baseQuantity, verified.totalPurchaseValue, verified.incomingUnitCost, raw.document_item_id]);
    result.push({ ...raw, base_quantity: verified.conversion.baseQuantity, entered_quantity: verified.enteredQuantity, entered_unit_id: verified.purchaseUnitId, entered_unit_name_snapshot: verified.conversion.enteredUnit.name, conversion_factor_to_base_snapshot: verified.conversion.factorToBase, conversion_path_snapshot: verified.conversion.conversionPath, converted_base_quantity: verified.conversion.baseQuantity, total_purchase_value: verified.totalPurchaseValue, derived_incoming_unit_cost: verified.incomingUnitCost, item_name_snapshot: verified.item.name, base_unit_snapshot: verified.conversion.baseUnit.name, storage_location_name_snapshot: verified.item.storage_location_name || null });
  } return result;
}
function canReject(workspace) { return Boolean(workspace?.isOwner || workspace?.role === 'MANAGER'); }
function allowedActions(document, actor, workspace) { const creator = document.created_by === actor?.id; return { edit: creator && EDITABLE.has(document.status), submit: creator && EDITABLE.has(document.status), reject: document.status === 'PENDING_APPROVAL' && canReject(workspace) }; }

export async function createGoodsReceiptDraft(payload, actor, workspace, { client: callerClient } = {}) {
  const userId = requiredActor(actor); const lines = normalizeLines(payload.lines); const ownsClient = !callerClient; const client = callerClient || await pool.connect();
  try { if (ownsClient) await client.query('begin'); const number = await allocateDocumentNumber(client, workspace.storeId, 'GOODS_RECEIPT'); const document = (await client.query(`insert into inventory_documents(tenant_id,store_id,document_type,document_number,created_by,note,effective_at) values($1,$2,'GOODS_RECEIPT',$3,$4,$5,$6) returning *`, [workspace.tenantId, workspace.storeId, number, userId, clean(payload.note) || null, payload.effectiveAt ?? payload.effective_at ?? null])).rows[0]; await insertTypedLines(client, document, lines); await addEvent(client, { documentId: document.id, actorId: userId, type: 'CREATED', toStatus: 'DRAFT', revision: 1, payload: { documentNumber: number, documentType: 'GOODS_RECEIPT', lineCount: lines.length } }); if (ownsClient) await client.query('commit'); return getGoodsReceipt(document.id, actor, workspace, { client }); } catch (error) { if (ownsClient) await client.query('rollback').catch(() => undefined); throw error; } finally { if (ownsClient) client.release(); }
}
export async function updateGoodsReceiptDraft(id, payload, actor, workspace) {
  const userId = requiredActor(actor); const client = await pool.connect();
  try { await client.query('begin'); const document = await lockedDocument(client, id, workspace.storeId); if (document.created_by !== userId || !EDITABLE.has(document.status)) throw new ApiError(403, 'Only the creator may edit a Draft or Rejected Goods Receipt.'); if (payload.note !== undefined) await client.query('update inventory_documents set note=$1,updated_at=now() where id=$2', [clean(payload.note) || null, id]); if (payload.lines !== undefined) { const lines = normalizeLines(payload.lines); await deleteTypedLines(client, id); await insertTypedLines(client, document, lines); } await addEvent(client, { documentId: id, actorId: userId, type: 'DRAFT_UPDATED', fromStatus: document.status, toStatus: document.status, revision: document.revision, payload: { linesChanged: payload.lines !== undefined } }); await client.query('commit'); return getGoodsReceipt(id, actor, workspace); } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
}
export async function submitGoodsReceipt(id, actor, workspace, { client: callerClient } = {}) {
  const userId = requiredActor(actor); const ownsClient = !callerClient; const client = callerClient || await pool.connect();
  try { if (ownsClient) await client.query('begin'); const document = await lockedDocument(client, id, workspace.storeId); if (document.created_by !== userId || !EDITABLE.has(document.status)) throw new ApiError(403, 'Only the creator may submit a Draft or Rejected Goods Receipt.'); const lines = await frozenLines(client, document, await loadReceiptLines(client, id)); const revision = document.status === 'REJECTED' ? Number(document.revision) + 1 : Number(document.revision); const snapshot = await buildDocumentSubmissionSnapshot(document, lines, revision, client); const contentHash = hashDocumentSubmissionSnapshot(snapshot); await client.query(`update inventory_documents set status='PENDING_APPROVAL',revision=$1,submitted_by=$2,submitted_at=now(),rejection_reason=null,updated_at=now() where id=$3`, [revision, userId, id]); await addEvent(client, { documentId: id, actorId: userId, type: 'SUBMITTED', fromStatus: document.status, toStatus: 'PENDING_APPROVAL', revision, contentHash, payload: { snapshot } }); if (ownsClient) await client.query('commit'); return getGoodsReceipt(id, actor, workspace, { client }); } catch (error) { if (ownsClient) await client.query('rollback').catch(() => undefined); throw error; } finally { if (ownsClient) client.release(); }
}
export async function rejectGoodsReceipt(id, reason, actor, workspace) {
  const userId = requiredActor(actor); if (!canReject(workspace)) throw new ApiError(403, 'Manager or Owner role is required.'); const text = clean(reason); if (!text) throw new ApiError(400, 'Rejection reason is required.'); const client = await pool.connect();
  try { await client.query('begin'); const document = await lockedDocument(client, id, workspace.storeId); if (document.status !== 'PENDING_APPROVAL') throw new ApiError(409, 'Goods Receipt is not pending approval.'); await client.query(`update inventory_documents set status='REJECTED',rejected_by=$1,rejected_at=now(),rejection_reason=$2,updated_at=now() where id=$3`, [userId, text, id]); await addEvent(client, { documentId: id, actorId: userId, type: 'REJECTED', fromStatus: 'PENDING_APPROVAL', toStatus: 'REJECTED', revision: document.revision, reason: text }); await client.query('commit'); return getGoodsReceipt(id, actor, workspace); } catch (error) { await client.query('rollback').catch(() => undefined); throw error; } finally { client.release(); }
}
function normalizeApprovalControls(payload) {
  if (payload === undefined || payload === null) return new Set();
  if (typeof payload !== 'object' || Array.isArray(payload)) throw receiptError(400, 'GOODS_RECEIPT_APPROVAL_CONTROLS_INVALID', 'Approval controls must be an object.');
  const keys = Object.keys(payload); if (keys.some((key) => key !== 'initialValuationLineIds')) throw receiptError(400, 'GOODS_RECEIPT_APPROVAL_EDITS_FORBIDDEN', 'Submitted receipt values cannot be edited during approval.');
  const ids = payload.initialValuationLineIds ?? [];
  if (!Array.isArray(ids)) throw receiptError(400, 'INITIAL_VALUATION_LINE_IDS_INVALID', 'initialValuationLineIds must be an array.');
  return new Set(ids.map((id) => clean(id)).filter(Boolean));
}
export function parseGoodsReceiptApprovalControls(payload) { return normalizeApprovalControls(payload); }
function frozenReceiptLine(line) {
  if (!line.converted_base_quantity || !line.derived_incoming_unit_cost || line.total_purchase_value === null || line.total_purchase_value === undefined) throw receiptError(409, 'GOODS_RECEIPT_SUBMISSION_SNAPSHOT_INCOMPLETE', 'Goods Receipt submitted values are incomplete.');
  return { ...line, baseQuantity: requirePositiveDecimal(line.converted_base_quantity, 'Frozen converted quantity'), purchaseValue: requireNonNegativeDecimal(line.total_purchase_value, 'Frozen purchase value'), incomingUnitCost: requireNonNegativeDecimal(line.derived_incoming_unit_cost, 'Frozen incoming unit cost') };
}
function approvalEligibility(item, storeId) {
  if (!item || item.store_id !== storeId) throw receiptError(409, 'GOODS_RECEIPT_ITEM_NOT_IN_STORE', 'Receipt item no longer belongs to this Store.');
  if (item.item_type === 'PRODUCT') { if (!item.product_id || item.product_deleted_at || item.product_status !== 'ACTIVE' || item.product_is_group) throw receiptError(409, 'GOODS_RECEIPT_ITEM_NO_LONGER_ELIGIBLE', 'Receipt Product is no longer active and eligible for approval.'); }
  else if (item.item_type !== 'RAW_INGREDIENT' || !item.ingredient_id || item.ingredient_deleted_at || item.ingredient_is_preparation) throw receiptError(409, 'GOODS_RECEIPT_ITEM_NO_LONGER_ELIGIBLE', 'Receipt Raw Ingredient is no longer active and eligible for approval.');
  if (compareDecimal(item.quantity_on_hand, '0') < 0) throw receiptError(409, 'NEGATIVE_INVENTORY_REQUIRES_RECONCILIATION', 'Receipt approval requires reconciliation of negative inventory.');
}
function knownValuation(item) { return item.cost_status === 'AVAILABLE' && item.inventory_value !== null && item.current_unit_cost !== null; }
function approvalValuation(item, line, confirmed) {
  const existingQuantity = String(item.quantity_on_hand); const requiresBootstrap = compareDecimal(existingQuantity, '0') > 0 && !knownValuation(item);
  if (item.item_type === 'PRODUCT' && item.product_inventory_mode === 'RECIPE_ON_SALE') {
    if (compareDecimal(existingQuantity, '0') > 0) throw receiptError(409, 'PRODUCT_STOCK_ACTIVATION_REQUIRES_RECONCILIATION', 'Product activation requires reconciliation of existing finished stock.');
    const valuation = calculateGoodsReceiptValuation({ existingQuantity: '0', inventoryValue: null, currentUnitCost: null, baseQuantity: line.baseQuantity, purchaseValue: line.purchaseValue });
    return { ...valuation, requiresBootstrap: false, previousQuantity: existingQuantity, previousCostStatus: item.cost_status, totalValuationDelta: line.purchaseValue, activatesProductStock: true };
  }
  if (requiresBootstrap && !confirmed) throw receiptError(409, 'INITIAL_INVENTORY_VALUATION_REQUIRED', 'Initial inventory valuation confirmation is required.');
  const valuation = calculateGoodsReceiptValuation({ existingQuantity, inventoryValue: knownValuation(item) ? String(item.inventory_value) : null, currentUnitCost: knownValuation(item) ? String(item.current_unit_cost) : null, baseQuantity: line.baseQuantity, purchaseValue: line.purchaseValue, initialValuationConfirmed: requiresBootstrap && confirmed });
  return { ...valuation, requiresBootstrap, previousQuantity: existingQuantity, previousCostStatus: item.cost_status, totalValuationDelta: valuation.initialValuationApplied ? addDecimal(line.purchaseValue, valuation.initialValuationValue) : line.purchaseValue, activatesProductStock: false };
}
// Pure boundary used by isolated tests and the approval posting handler; balance persistence is
// intentionally delegated to InventoryPostingService after item locks are held.
export function calculateGoodsReceiptApprovalValuation(item, line, confirmed = false) { return approvalValuation(item, frozenReceiptLine(line), confirmed); }
async function persistApprovalSnapshots(client, plans) {
  for (const plan of plans) await client.query(`update inventory_receipt_line_details set initial_valuation_applied=$1,initial_existing_quantity_snapshot=$2::numeric,initial_valuation_unit_cost_snapshot=$3::numeric,initial_valuation_value_snapshot=$4::numeric,resulting_quantity_snapshot=$5::numeric,resulting_inventory_value_snapshot=$6::numeric,resulting_unit_cost_snapshot=$7::numeric,updated_at=now() where document_item_id=$8`, [plan.valuation.initialValuationApplied, plan.valuation.initialExistingQuantity, plan.valuation.initialValuationApplied ? plan.line.incomingUnitCost : null, plan.valuation.initialValuationValue, plan.valuation.resultingQuantity, plan.valuation.resultingInventoryValue, plan.valuation.resultingUnitCost, plan.line.document_item_id]);
}
export async function approveGoodsReceipt(id, payload, actor, workspace, { client } = {}) {
  const confirmedLineIds = normalizeApprovalControls(payload); const userId = requiredActor(actor);
  const approved = await approveDocumentWithPosting({ documentId: id, actor, workspace, client, postingHandler: async (client, document) => {
    const lines = (await loadReceiptLines(client, document.id)).map(frozenReceiptLine);
    if (!lines.length) throw receiptError(409, 'GOODS_RECEIPT_LINES_REQUIRED', 'Goods Receipt requires submitted receipt lines.');
    const receiptLineIds = new Set(lines.map((line) => line.document_item_id));
    for (const lineId of confirmedLineIds) if (!receiptLineIds.has(lineId)) throw receiptError(400, 'INITIAL_VALUATION_LINE_NOT_IN_RECEIPT', 'Initial valuation confirmation references a line outside this Goods Receipt.');
    const plans = [];
    const posting = await postInventoryMovements(client, { storeId: document.store_id, actorId: userId, postingGroupKey: `document:${document.id}:receipt`, movements: lines.map((line) => ({ inventoryItemId: line.inventory_item_id, postingKey: `document:${document.id}:line:${line.document_item_id}:receipt`, movementType: 'RECEIPT_IN', quantityDelta: line.baseQuantity, unitCostSnapshot: line.incomingUnitCost, valueDelta: line.purchaseValue, documentId: document.id, documentItemId: line.document_item_id, metadata: { receipt: true, purchaseValue: line.purchaseValue, unitCostSnapshotMeaning: 'INCOMING_UNIT_COST' } })), prepareLockedMovements: async ({ lockedItems, movements }) => {
      const productIds = lockedItems.filter((item) => item.item_type === 'PRODUCT').map((item) => item.product_id).sort();
      if (productIds.length) await client.query(`select id from products where id=any($1::uuid[]) and store_id=$2 order by id for update`, [productIds, document.store_id]);
      const locked = new Map(lockedItems.map((item) => [item.id, item]));
      for (const movement of movements) { const line = lines.find((candidate) => candidate.inventory_item_id === movement.inventoryItemId); const item = locked.get(movement.inventoryItemId); approvalEligibility(item, document.store_id); const valuation = approvalValuation(item, line, confirmedLineIds.has(line.document_item_id));
        movement.valueDelta = valuation.totalValuationDelta; movement.balanceMutation = { resultingInventoryValue: valuation.resultingInventoryValue, resultingUnitCost: valuation.resultingUnitCost, resultingCostStatus: 'AVAILABLE' }; movement.metadata = JSON.stringify({ receipt: true, purchaseValue: line.purchaseValue, initialValuationApplied: valuation.initialValuationApplied, initialValuationValue: valuation.initialValuationValue, totalValuationDelta: valuation.totalValuationDelta, incomingUnitCost: line.incomingUnitCost, resultingUnitCost: valuation.resultingUnitCost, unitCostSnapshotMeaning: 'INCOMING_UNIT_COST' }); plans.push({ line, valuation }); }
    } });
    if (posting.alreadyPosted) throw receiptError(409, 'GOODS_RECEIPT_POSTING_STATE_INCONSISTENT', 'Receipt movements already exist while the document is pending approval.');
    for (const { line, valuation } of plans.filter((plan) => plan.valuation.activatesProductStock)) {
      await client.query(`update inventory_items set product_inventory_mode='STOCKED',stock_activated_at=coalesce(stock_activated_at,now()),updated_at=now() where id=$1 and store_id=$2`, [line.inventory_item_id, document.store_id]);
    }
    await persistApprovalSnapshots(client, plans);
    await recalculateDependentRecipeCosts(client, { storeId: document.store_id, sourceInventoryItemIds: lines.map((line) => line.inventory_item_id) });
    return { approvalEventMetadata: { receiptPosting: plans.map(({ line, valuation }) => ({ documentItemId: line.document_item_id, previousQuantity: valuation.previousQuantity, previousCostStatus: valuation.previousCostStatus, incomingUnitCost: line.incomingUnitCost, purchaseValue: line.purchaseValue, initialValuationApplied: valuation.initialValuationApplied, initialValuationValue: valuation.initialValuationValue, totalValuationDelta: valuation.totalValuationDelta, resultingQuantity: valuation.resultingQuantity, resultingInventoryValue: valuation.resultingInventoryValue, resultingWAC: valuation.resultingUnitCost, valuationMode: valuation.initialValuationApplied ? 'INITIAL_VALUATION_BOOTSTRAP' : 'NORMAL_WAC' })) } };
  }});
  return { document: await getGoodsReceipt(id, actor, workspace, { client }), alreadyApproved: false, genericDocument: approved };
}
function dtoLine(line, includeReview) {
  const submitted = Boolean(line.converted_base_quantity && line.conversion_factor_to_base_snapshot); const baseQuantity = submitted ? line.converted_base_quantity : null; const purchaseValue = line.total_purchase_value; const dto = { lineNumber: Number(line.line_number), itemName: line.item_name_snapshot || line.current_item_name, location: line.storage_location_name_snapshot || line.current_location_name || null, baseUnit: line.base_unit_snapshot || line.current_base_unit_name || null, purchaseUnit: line.entered_unit_name_snapshot || line.current_purchase_unit_name || null, enteredQuantity: String(line.entered_quantity), convertedBaseQuantity: baseQuantity === null ? null : String(baseQuantity), purchaseValue: String(purchaseValue), incomingUnitCost: line.derived_incoming_unit_cost === null ? null : String(line.derived_incoming_unit_cost), note: line.note || null };
  if (includeReview) { const currentQuantity = String(line.quantity_on_hand ?? '0'); const currentCost = line.current_unit_cost === null ? null : String(line.current_unit_cost); const currentValue = line.inventory_value === null ? null : String(line.inventory_value); const initialValuationRequired = compareDecimal(currentQuantity, '0') > 0 && (currentCost === null || currentValue === null); let projection = null; let warning = null; if (baseQuantity !== null) { try { projection = calculateGoodsReceiptValuation({ existingQuantity: currentQuantity, inventoryValue: currentValue, currentUnitCost: currentCost, baseQuantity, purchaseValue, initialValuationConfirmed: initialValuationRequired }); } catch (error) { warning = error.code || error.message; } } dto.review = { currentQuantity, currentCost, projectedQuantity: projection?.resultingQuantity || null, projectedWAC: projection?.resultingUnitCost || null, initialValuationRequired, warning }; }
  if (line.resulting_quantity_snapshot !== null && line.resulting_quantity_snapshot !== undefined) dto.approvedActuals = { initialValuationApplied: Boolean(line.initial_valuation_applied), initialValuationValue: line.initial_valuation_value_snapshot === null ? null : String(line.initial_valuation_value_snapshot), resultingQuantity: String(line.resulting_quantity_snapshot), resultingInventoryValue: String(line.resulting_inventory_value_snapshot), resultingWAC: String(line.resulting_unit_cost_snapshot) };
  return dto;
}
export async function getGoodsReceipt(id, actor, workspace, { client } = {}) {
  const executor = client || { query };
  const result = await executor.query(`select d.*,coalesce(u.full_name,u.username) creator_name,coalesce(au.full_name,au.username) approver_name from inventory_documents d join app_users u on u.id=d.created_by left join app_users au on au.id=d.approved_by where d.id=$1 and d.store_id=$2 and d.document_type='GOODS_RECEIPT'`, [id, workspace.storeId]); const document = result.rows[0]; if (!document) throw new ApiError(404, 'Goods Receipt not found.'); const lines = await loadReceiptLines(executor, id); const review = document.status === 'PENDING_APPROVAL' && (canReject(workspace) || document.created_by === actor?.id); return { documentNumber: document.document_number, status: document.status, revision: Number(document.revision), creator: document.creator_name, approval: document.approved_at ? { actor: document.approver_name, approvedAt: document.approved_at, postedAt: document.posted_at } : null, createdAt: document.created_at, updatedAt: document.updated_at, submittedAt: document.submitted_at, rejectedAt: document.rejected_at, rejectionReason: document.rejection_reason || null, note: document.note || null, allowedActions: allowedActions(document, actor, workspace), lines: lines.map((line) => dtoLine(line, review)) };
}

registerDocumentValidator('GOODS_RECEIPT', async (document, _lines, client) => { await frozenLines(client, document, await loadReceiptLines(client, document.id)); });
registerSubmissionSnapshotExtension('GOODS_RECEIPT', async (document, _lines, client) => buildGoodsReceiptSubmissionSnapshot(document, await loadReceiptLines(client, document.id)));
