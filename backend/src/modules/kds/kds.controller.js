import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { completeKdsOrder, listKdsOrdersForStaff } from './kds.service.js';

export const getKdsOrders = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await listKdsOrdersForStaff(req.user, storeId);

  return sendSuccess(res, {
    message: 'KDS orders loaded successfully.',
    data,
  });
});

export const markOrderAsCompleted = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const order = await completeKdsOrder(req.params.id, req.user, storeId);

  return sendSuccess(res, {
    message: 'KDS order completed successfully.',
    data: {
      order,
    },
  });
});

