import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { approveGoodsReceipt, createGoodsReceiptDraft, getGoodsReceipt, rejectGoodsReceipt, submitGoodsReceipt, updateGoodsReceiptDraft } from './goods-receipt.service.js';

export const createGoodsReceipt = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Goods Receipt draft created successfully.', statusCode: 201,
  data: { document: await createGoodsReceiptDraft(req.body, req.user, req.workspace) },
}));
export const getGoodsReceiptById = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Goods Receipt loaded successfully.', data: { document: await getGoodsReceipt(req.params.id, req.user, req.workspace) },
}));
export const updateGoodsReceipt = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Goods Receipt draft updated successfully.', data: { document: await updateGoodsReceiptDraft(req.params.id, req.body, req.user, req.workspace) },
}));
export const submitGoodsReceiptDocument = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Goods Receipt submitted for review.', data: { document: await submitGoodsReceipt(req.params.id, req.user, req.workspace) },
}));
export const rejectGoodsReceiptDocument = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Goods Receipt rejected.', data: { document: await rejectGoodsReceipt(req.params.id, req.body?.reason, req.user, req.workspace) },
}));
export const approveGoodsReceiptDocument = asyncHandler(async (req, res) => sendSuccess(res, {
  message: 'Goods Receipt approved and posted.', data: await approveGoodsReceipt(req.params.id, req.body, req.user, req.workspace),
}));
