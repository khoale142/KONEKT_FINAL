import { Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { PageLoader } from '../../components/feedback/PageLoader.jsx';
import { ROUTES } from '../../constants/routes.js';

export function ProtectedRoute({ children, requireWorkspaceType, requireWorkspaceRole }) {
  const { user, workspace, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <PageLoader text="Đang kiểm tra phiên đăng nhập..." />;
  }

  if (!user) {
    return <Navigate to={ROUTES.LOGIN} replace />;
  }

  // If a specific workspace type is required, check it
  if (requireWorkspaceType) {
    if (!workspace || workspace.type !== requireWorkspaceType) {
      return <Navigate to={ROUTES.WORKSPACES} replace />;
    }
  }

  if (requireWorkspaceRole) {
    if (!workspace || workspace.role !== requireWorkspaceRole) {
      if (workspace?.type === WORKSPACE_TYPES.STORE) {
        return <Navigate to={ROUTES.STORE_POS} replace />;
      }
      return <Navigate to={ROUTES.WORKSPACES} replace />;
    }
  }

  return children;
}
