import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getUserById, listStoreStaff, removeStaffFromStore, resetUserPassword } from './user.service.js';

export const getStoreStaffList = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  const staff = await listStoreStaff(storeId, req.query);

  return sendSuccess(res, {
    message: 'Store staff loaded successfully.',
    data: {
      users: staff,
    },
  });
});

export const getStoreStaffDetail = asyncHandler(async (req, res) => {
  const user = await getUserById(req.params.id);

  return sendSuccess(res, {
    message: 'Staff detail loaded successfully.',
    data: {
      user,
    },
  });
});

export const kickStaffFromStore = asyncHandler(async (req, res) => {
  const storeId = req.workspace.storeId;
  await removeStaffFromStore(req.params.id, storeId);

  return sendSuccess(res, {
    message: 'Staff removed from store successfully.',
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await resetUserPassword(req.params.id, req.body);

  return sendSuccess(res, {
    message: 'Password has been reset successfully.',
    data: {
      user,
    },
  });
});
