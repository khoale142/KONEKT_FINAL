import { ApiError } from '../utils/ApiError.js';
import { WORKSPACE_TYPES } from '../constants/roles.js';

export function requireWorkspace() {
  return (req, res, next) => {
    if (!req.workspace || !req.workspace.type) {
      return next(new ApiError(403, 'Access denied. Workspace context required.'));
    }
    return next();
  };
}

export function requireOwner() {
  return (req, res, next) => {
    if (!req.workspace || !req.workspace.isOwner) {
      return next(new ApiError(403, 'Access denied. You must be the owner to perform this action.'));
    }
    return next();
  };
}

export function requireStoreContext() {
  return (req, res, next) => {
    if (!req.workspace || req.workspace.type !== WORKSPACE_TYPES.STORE || !req.workspace.storeId) {
      return next(new ApiError(403, 'Access denied. Store context required.'));
    }
    return next();
  };
}
