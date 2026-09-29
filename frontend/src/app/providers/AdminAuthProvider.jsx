import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  adminApiClient,
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from '../../services/adminApiClient.js';
import { adminAuthApi } from '../../features/admin/auth/api/adminAuthApi.js';

const AdminAuthContext = createContext(null);

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(getAdminToken()));

  const refreshAdminUser = async () => {
    try {
      const response = await adminAuthApi.getMe();
      const user = response.data?.user || response.data;
      setAdminUser(user);
      return user;
    } catch (err) {
      clearAdminToken();
      setAdminUser(null);
      throw err;
    }
  };

  useEffect(() => {
    const initAdminAuth = async () => {
      const token = getAdminToken();
      if (!token) {
        setIsBootstrapping(false);
        return;
      }

      try {
        await refreshAdminUser();
      } catch (err) {
        console.error('Failed to restore admin auth session:', err);
      } finally {
        setIsBootstrapping(false);
      }
    };

    initAdminAuth();
  }, []);

  const adminLogin = async ({ email, password, remember = false }) => {
    const response = await adminAuthApi.login({ email, password, remember });
    const { token, user } = response.data || {};

    if (token) {
      setAdminToken(token);
    }
    setAdminUser(user);

    return user;
  };

  const adminLogout = async () => {
    try {
      await adminAuthApi.logout().catch(() => {});
    } finally {
      clearAdminToken();
      setAdminUser(null);
    }
  };

  const value = useMemo(
    () => ({
      adminUser,
      isAdminAuthenticated: Boolean(adminUser),
      isBootstrapping,
      adminLogin,
      adminLogout,
      refreshAdminUser,
      setAdminUser,
    }),
    [adminUser, isBootstrapping],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider');
  }

  return context;
}

export default AdminAuthProvider;
