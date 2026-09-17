import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  adjustStock,
  countStockDaily,
  importStock,
  importStockBatch,
  listStockTransactions,
  getStockForecast,
  discardStock,
} from './stock.service.js';

export const performStockImport = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await importStock(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Stock imported successfully.',
    statusCode: 201,
    data,
  });
});

export const performStockAdjustment = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await adjustStock(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Stock adjusted successfully.',
    statusCode: 201,
    data,
  });
});

export const performBatchStockImport = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await importStockBatch(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Batch stock import processed successfully.',
    statusCode: 201,
    data,
  });
});

export const performDailyStockCount = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const data = await countStockDaily(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Daily stock count processed successfully.',
    statusCode: 201,
    data,
  });
});

export const getStockTransactions = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const transactions = await listStockTransactions(req.query, storeId);

  return sendSuccess(res, {
    message: 'Stock transactions loaded successfully.',
    data: {
      transactions,
    },
  });
});

export const getStockForecastList = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const forecasts = await getStockForecast(storeId);
  return sendSuccess(res, {
    message: 'Stock forecast loaded successfully.',
    data: forecasts
  });
});

export const discardStockItem = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  await discardStock(req.body, req.user, storeId);
  return sendSuccess(res, {
    message: 'Stock discarded successfully.',
    statusCode: 200,
  });
});
