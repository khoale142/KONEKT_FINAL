import { sendSuccess } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getMyWorkspaces, selectWorkspace } from './workspace.service.js';

export const getWorkspaces = asyncHandler(async (req, res) => {
  const data = await getMyWorkspaces(req.user.id);
  
  return sendSuccess(res, {
    message: 'Workspaces loaded successfully.',
    data,
  });
});

export const select = asyncHandler(async (req, res) => {
  const data = await selectWorkspace(req.user.id, req.body);
  
  return sendSuccess(res, {
    message: 'Workspace selected successfully.',
    data,
  });
});
