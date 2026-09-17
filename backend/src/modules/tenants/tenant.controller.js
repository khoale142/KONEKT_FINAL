import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createTenant, getMyTenants, getTenantDetail } from './tenant.service.js';

export const create = asyncHandler(async (req, res) => {
  const data = await createTenant(req.user.id, req.body);
  
  return sendSuccess(res, {
    message: 'Tenant created successfully.',
    data,
  });
});

export const getTenants = asyncHandler(async (req, res) => {
  const data = await getMyTenants(req.user.id);
  
  return sendSuccess(res, {
    message: 'Tenants loaded successfully.',
    data,
  });
});

export const getTenant = asyncHandler(async (req, res) => {
  const data = await getTenantDetail(req.workspace.tenantId);
  
  return sendSuccess(res, {
    message: 'Tenant detail loaded successfully.',
    data,
  });
});
