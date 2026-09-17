import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getSummary } from './dashboard.service.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await getSummary(storeId);

  return sendSuccess(res, {
    message: 'Dashboard data loaded successfully.',
    data,
  });
});
