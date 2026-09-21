const PREFIXES = Object.freeze({
  GOODS_RECEIPT: 'PN', STOCK_COUNT: 'KK', INVENTORY_ADJUSTMENT: 'DC', WASTE_LOSS: 'HH',
  PREPARATION_PRODUCTION: 'SX-BTP', PRODUCT_PRODUCTION: 'SX-SP', STORE_TRANSFER: 'CK', REVERSAL: 'RV',
});

export function getDocumentPrefix(documentType) {
  const prefix = PREFIXES[documentType];
  if (!prefix) throw new Error(`Unsupported inventory document type: ${documentType}`);
  return prefix;
}

export async function allocateDocumentNumber(client, storeId, documentType) {
  const result = await client.query(`
    insert into inventory_document_sequences(store_id,document_type,next_number)
    values($1,$2::inventory_document_type,2)
    on conflict(store_id,document_type) do update
      set next_number=inventory_document_sequences.next_number+1,updated_at=now()
    returning next_number-1 as allocated_number`, [storeId, documentType]);
  return `${getDocumentPrefix(documentType)}-${String(result.rows[0].allocated_number).padStart(6, '0')}`;
}
