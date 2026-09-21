import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { AppLayout } from '../../components/layout/AppLayout.jsx';

import { LoginPage } from '../../features/auth/pages/LoginPage.jsx';
import { RegisterPage } from '../../features/auth/pages/RegisterPage.jsx';
import { WorkspacesPage } from '../../features/workspaces/pages/WorkspacesPage.jsx';
import { TenantStoreSelectPage } from '../../features/workspaces/pages/TenantStoreSelectPage.jsx';
import { StoreManagementPage } from '../../features/stores/pages/StoreManagementPage.jsx';

import { AdminDashboardPage } from '../../features/dashboard/pages/AdminDashboardPage.jsx';
import { ProfilePage } from '../../features/profile/pages/ProfilePage.jsx';
import { CatalogPage } from '../../features/catalog/pages/CatalogPage.jsx';
import { StockPage } from '../../features/stock/pages/StockPage.jsx';
import { ReportsPage } from '../../features/reports/pages/ReportsPage.jsx';
import { KDSPage } from '../../features/kds/pages/KDSPage.jsx';
import { POSPage } from '../../features/pos/pages/POSPage.jsx';
import { StaffSessionPage } from '../../features/pos/pages/StaffSessionPage.jsx';
import { OrderHistoryPage } from '../../features/orders/pages/OrderHistoryPage.jsx';
import { OrderDetailPage } from '../../features/orders/pages/OrderDetailPage.jsx';
import { StaffHRPage } from '../../features/hr/pages/StaffHRPage.jsx';
import { AdminHRPage } from '../../features/hr/pages/AdminHRPage.jsx';
import { AdminCalendarPage } from '../../features/hr/pages/AdminCalendarPage.jsx';
import { AttendancePage } from '../../features/hr/pages/AttendancePage.jsx';

import { WORKSPACE_TYPES } from '../../constants/roles.js';
import { ROUTES } from '../../constants/routes.js';

function RoleHomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to={ROUTES.LOGIN} replace />;
  return <Navigate to={ROUTES.WORKSPACES} replace />;
}

function CatalogItemRedirect({ type }) {
  const { id } = useParams();
  const key = type === 'PRODUCT' ? 'editProduct' : 'editIngredient';
  return <Navigate to={`${ROUTES.STORE_CATALOG}?${key}=${encodeURIComponent(id)}`} replace />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
      
      <Route 
        path={ROUTES.WORKSPACES} 
        element={
          <ProtectedRoute>
            <WorkspacesPage />
          </ProtectedRoute>
        } 
      />

      <Route
        path="/owner/select-store"
        element={
          <ProtectedRoute requireWorkspaceType={WORKSPACE_TYPES.TENANT}>
            <TenantStoreSelectPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/owner/*"
        element={
          <ProtectedRoute requireWorkspaceType={WORKSPACE_TYPES.TENANT}>
            <AppLayout>
              <Routes>
                <Route path="stores" element={<StoreManagementPage />} />
                <Route path="*" element={<Navigate to={ROUTES.OWNER_STORES} replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/store/*"
        element={
          <ProtectedRoute requireWorkspaceType={WORKSPACE_TYPES.STORE}>
            <AppLayout>
              <Routes>
                <Route path="dashboard" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><AdminDashboardPage /></ProtectedRoute>} />
                <Route path="catalog" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><CatalogPage /></ProtectedRoute>} />
                <Route path="products" element={<Navigate to={ROUTES.STORE_PRODUCTS} replace />} />
                <Route path="products/new" element={<Navigate to={ROUTES.STORE_PRODUCTS_NEW} replace />} />
                <Route path="products/:id/edit" element={<CatalogItemRedirect type="PRODUCT" />} />
                <Route path="ingredients" element={<Navigate to={ROUTES.STORE_INGREDIENTS} replace />} />
                <Route path="ingredients/new" element={<Navigate to={ROUTES.STORE_INGREDIENTS_NEW} replace />} />
                <Route path="ingredients/:id/edit" element={<CatalogItemRedirect type="INGREDIENT" />} />
                <Route path="recipes" element={<Navigate to={ROUTES.STORE_PRODUCTS} replace />} />
                <Route path="recipes/new" element={<Navigate to={ROUTES.STORE_PRODUCTS} replace />} />
                <Route path="recipes/:id/edit" element={<Navigate to={ROUTES.STORE_PRODUCTS} replace />} />
                <Route path="reports" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><ReportsPage /></ProtectedRoute>} />
                <Route path="manager-hr/calendar" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><AdminCalendarPage /></ProtectedRoute>} />
                <Route path="manager-hr" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><AdminHRPage /></ProtectedRoute>} />
                <Route path="pos" element={<POSPage />} />
                <Route path="session" element={<StaffSessionPage />} />
                <Route path="kds" element={<KDSPage />} />
                <Route path="orders" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><OrderHistoryPage /></ProtectedRoute>} />
                <Route path="orders/:id" element={<ProtectedRoute requireWorkspaceRole="MANAGER"><OrderDetailPage /></ProtectedRoute>} />
                <Route path="stock" element={<StockPage />} />
                <Route path="hr" element={<StaffHRPage />} />
                <Route path="hr/attendance" element={<AttendancePage />} />
                <Route path="*" element={<Navigate to={ROUTES.STORE_POS} replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path={ROUTES.PROFILE}
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProfilePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}

export default AppRouter;
