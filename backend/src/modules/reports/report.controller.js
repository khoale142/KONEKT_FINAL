import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as reportService from './report.service.js';

export const getRevenueReport = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await reportService.listRevenueReport(storeId, req.query);

  return sendSuccess(res, {
    message: 'Revenue report loaded.',
    data: {
      items: data,
    },
  });
});

export const getBestSellingProducts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await reportService.listBestSellingProducts(storeId, req.query);

  return sendSuccess(res, {
    message: 'Best selling products loaded.',
    data: {
      items: data,
    },
  });
});

export const getLowStockIngredients = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await reportService.listLowStockIngredients(storeId);

  return sendSuccess(res, {
    message: 'Low stock ingredients loaded.',
    data: {
      items: data,
    },
  });
});

export const getDiscardReport = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await reportService.listDiscardReport(storeId, req.query);

  return sendSuccess(res, {
    message: 'Discard report loaded.',
    data: {
      items: data,
    },
  });
});
