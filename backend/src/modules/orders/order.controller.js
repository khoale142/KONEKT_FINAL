import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createOrder,
  getOrderByIdForOwner,
  getOrderByIdForStaff,
  listOrdersForOwner,
  listOrdersForStaff,
  refundOrderItems,
} from './order.service.js';

export const createNewOrder = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const order = await createOrder(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Order created successfully.',
    statusCode: 201,
    data: {
      order,
    },
  });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const orders = await listOrdersForStaff(req.user, req.query, storeId);

  return sendSuccess(res, {
    message: 'Orders loaded successfully.',
    data: {
      orders,
    },
  });
});

export const getMyOrderById = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const order = await getOrderByIdForStaff(req.params.id, req.user, storeId);

  return sendSuccess(res, {
    message: 'Order loaded successfully.',
    data: {
      order,
    },
  });
});

export const refundItems = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const order = await refundOrderItems(req.params.id, req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Items refunded successfully.',
    data: {
      order,
    },
  });
});

export const getAllOrders = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const orders = await listOrdersForOwner(req.user, req.query, storeId);

  return sendSuccess(res, {
    message: 'Orders loaded successfully.',
    data: {
      orders,
    },
  });
});

export const getOrderById = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const order = await getOrderByIdForOwner(req.params.id, req.user, storeId);

  return sendSuccess(res, {
    message: 'Order loaded successfully.',
    data: {
      order,
    },
  });
});
