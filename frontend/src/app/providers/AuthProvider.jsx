import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiClient,
  clearAuthToken,
  clearWorkspaceToken,
  setAuthToken,
  setWorkspaceToken,
} from '../../services/apiClient.js';
import { jwtDecode } from 'jwt-decode';

const AuthContext = createContext(null);
const initialAccessToken = localStorage.getItem('accessToken');
const initialWorkspaceToken = localStorage.getItem('workspaceToken');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [isBootstrapping, setIsBootstrapping] = useState(Boolean(initialAccessToken));

  const refreshUser = async () => {
    const response = await apiClient.get('/auth/me');
    setUser(response.data.user);
    return response.data.user;
  };

  const setCurrentUser = (nextUser) => {
    setUser(nextUser);
  };

  useEffect(() => {
    const initAuth = async () => {
      const token = initialAccessToken;
      if (!token) {
        setIsBootstrapping(false);
        return;
      }

      setAuthToken(token);

      if (initialWorkspaceToken) {
        setWorkspaceToken(initialWorkspaceToken);
        try {
          const decoded = jwtDecode(initialWorkspaceToken);
          setWorkspace({
            type: decoded.workspaceType,
            id: decoded.workspaceId,
            tenantId: decoded.tenantId, // Assuming we include this if needed, or we fetch details later
          });
        } catch (e) {
          clearWorkspaceToken();
        }
      }

      try {
        await refreshUser();
      } catch (err) {
        clearAuthToken();
        clearWorkspaceToken();
        setUser(null);
        setWorkspace(null);
      } finally {
        setIsBootstrapping(false);
      }
    };

    initAuth();
  }, []);

  const login = async ({ username, password }) => {
    const response = await apiClient.post('/auth/login', { username, password });
    const { token, user: loggedInUser } = response.data;

    setAuthToken(token);
    setUser(loggedInUser);

    return loggedInUser;
  };

  const register = async ({ username, email, fullName, password }) => {
    const response = await apiClient.post('/auth/register', { username, email, fullName, password });
    const { token, user: loggedInUser } = response.data;

    setAuthToken(token);
    setUser(loggedInUser);

    return loggedInUser;
  };

  const selectWorkspace = async ({ workspaceType, workspaceId }) => {
    const response = await apiClient.post('/workspaces/select', { workspaceType, workspaceId });
    const { token, workspace: workspaceData } = response.data;

    setWorkspaceToken(token);
    
    // We can also decode token or just use what server returns
    setWorkspace(workspaceData);

    return workspaceData;
  };

  const switchWorkspace = () => {
    clearWorkspaceToken();
    setWorkspace(null);
  };

  const logout = () => {
    clearAuthToken();
    clearWorkspaceToken();
    setUser(null);
    setWorkspace(null);
  };

  const value = useMemo(
    () => ({
      user,
      workspace,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      register,
      logout,
      refreshUser,
      setCurrentUser,
      selectWorkspace,
      switchWorkspace,
    }),
    [user, workspace, isBootstrapping],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
