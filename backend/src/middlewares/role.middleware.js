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
  return requireTenantOwner();
}

export function requireTenantOwner() {
  return (req, res, next) => {
    if (!req.workspace || req.workspace.type !== WORKSPACE_TYPES.TENANT || !req.workspace.isOwner) {
      return next(new ApiError(403, 'Access denied. You must be the owner to perform this action.'));
    }
    return next();
  };
}

export function requireStoreContext() {
  return (req, res, next) => {
    if (!req.workspace || req.workspace.type !== WORKSPACE_TYPES.STORE || !req.workspace.storeId) {
      return next(new ApiError(403, 'Access denied. Store context required. Vui lòng tạo ít nhất một chi nhánh.'));
    }
    return next();
  };
}

export function requireStoreManager() {
  return (req, res, next) => {
    if (
      req.workspace
      && req.workspace.type === WORKSPACE_TYPES.STORE
      && req.workspace.storeId
      && (req.workspace.isOwner || req.workspace.role === 'MANAGER')
    ) {
      return next();
    }
    return next(new ApiError(403, 'Access denied. You must be a store manager to perform this action.'));
  };
}
