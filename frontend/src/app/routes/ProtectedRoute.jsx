import { Navigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { PageLoader } from '../../components/feedback/PageLoader.jsx';
import { ROUTES } from '../../constants/routes.js';

export function ProtectedRoute({ children, requireWorkspaceType }) {
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

  return children;
}
