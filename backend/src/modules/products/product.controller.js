import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  createProduct,
  getProductById,
  listPosAvailableProducts,
  listProducts,
  softDeleteProduct,
  updateProduct,
  createBulkProducts,
  addProductSize,
  updateProductSize,
  reorderProductSizes,
  archiveProductSize,
  assignProductsToCategory,
} from './product.service.js';

export const getProducts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const products = await listProducts(req.query, storeId);

  return sendSuccess(res, {
    message: 'Products loaded successfully.',
    data: {
      products,
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

export const bulkCreateProducts = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const products = await createBulkProducts(req.body, req.user, storeId);

  return sendSuccess(res, {
    message: 'Products bulk created successfully.',
    statusCode: 201,
    data: {
      products,
    },
  });
});

export const assignProductCategories = asyncHandler(async (req, res) => {
  const products = await assignProductsToCategory(req.body, req.workspace.storeId);
  return sendSuccess(res, {
    message: 'Product categories updated successfully.',
    data: { products },
  });
});

export const updateExistingProduct = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await updateProduct(req.params.id, req.body, req.user, storeId);

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

export const addNewProductSize = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await addProductSize(req.params.id, req.body, req.user, storeId);
  return sendSuccess(res, {
    message: 'Product size added successfully.',
    statusCode: 201,
    data: { product },
  });
});

export const updateExistingProductSize = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await updateProductSize(req.params.id, req.params.sizeId, req.body, req.user, storeId);
  return sendSuccess(res, {
    message: 'Product size updated successfully.',
    data: { product },
  });
});

export const reorderExistingProductSizes = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await reorderProductSizes(req.params.id, req.body, storeId);
  return sendSuccess(res, {
    message: 'Product sizes reordered successfully.',
    data: { product },
  });
});

export const archiveExistingProductSize = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const product = await archiveProductSize(req.params.id, req.params.sizeId, storeId);
  return sendSuccess(res, {
    message: 'Product size archived successfully.',
    data: { product },
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
