import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createProduct,
  getProductById,
  listPosAvailableProducts,
  listProductTags,
  listProducts,
  softDeleteProduct,
  updateProduct,
} from './product.service.js';

export const getProducts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const [products, tags] = await Promise.all([listProducts(req.query, storeId), listProductTags(storeId)]);

  return sendSuccess(res, {
    message: 'Products loaded successfully.',
    data: {
      products,
      tags,
    },
  });
});

export const getProduct = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await getProductById(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Product loaded successfully.',
    data: {
      product,
    },
  });
});

export const createNewProduct = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await createProduct(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Product created successfully.',
    statusCode: 201,
    data: {
      product,
    },
  });
});

export const updateExistingProduct = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await updateProduct(req.params.id, req.body, storeId);

  return sendSuccess(res, {
    message: 'Product updated successfully.',
    data: {
      product,
    },
  });
});

export const deleteExistingProduct = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await softDeleteProduct(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Product deleted successfully.',
    data: {
      product,
    },
  });
});

export const getPosAvailableProducts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const products = await listPosAvailableProducts(storeId);

  return sendSuccess(res, {
    message: 'POS available products loaded successfully.',
    data: {
      products,
    },
  });
});
