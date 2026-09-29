import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../providers/AdminAuthProvider.jsx';
import { ADMIN_ROUTES } from '../../constants/adminRoutes.js';
import { PageLoader } from '../../components/feedback/PageLoader.jsx';

export function AdminProtectedRoute({ children, requiredRole }) {
  const { adminUser, isAdminAuthenticated, isBootstrapping } = useAdminAuth();
  const location = useLocation();

  if (isBootstrapping) {
    return <PageLoader message="Đang kiểm tra chứng chỉ quản trị..." />;
  }

  if (!isAdminAuthenticated || !adminUser) {
    return <Navigate to={ADMIN_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  if (requiredRole && adminUser.role !== requiredRole && adminUser.role !== 'SUPER_ADMIN') {
    return <Navigate to={ADMIN_ROUTES.DASHBOARD} replace />;
  }

  return children;
}

export default AdminProtectedRoute;
