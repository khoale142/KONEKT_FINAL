import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createStore, joinStoreByInviteCode, listStoreStaff, regenerateInviteCode } from './store.service.js';

export const create = asyncHandler(async (req, res) => {
  const { name, address, sourceStoreId } = req.body;
  const data = await createStore(req.workspace.tenantId, { name, address }, sourceStoreId);
  
  return sendSuccess(res, {
    message: 'Store created successfully.',
    data,
  });
});

export const join = asyncHandler(async (req, res) => {
  const data = await joinStoreByInviteCode(req.user.id, req.body.inviteCode);
  
  return sendSuccess(res, {
    message: 'Joined store successfully.',
    data,
  });
});

export const regenerateCode = asyncHandler(async (req, res) => {
  const data = await regenerateInviteCode(req.params.id);
  
  return sendSuccess(res, {
    message: 'Invite code regenerated successfully.',
    data,
  });
});

export const getStoreStaff = asyncHandler(async (req, res) => {
  const data = await listStoreStaff(req.params.id);
  
  return sendSuccess(res, {
    message: 'Store staff loaded successfully.',
    data,
  });
});
