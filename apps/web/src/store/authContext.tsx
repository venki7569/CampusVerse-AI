import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { disconnectSocket } from '../services/socket';

export type RoleName =
  | 'SUPER_ADMIN'
  | 'CAMPUS_ADMIN'
  | 'DEPARTMENT_ADMIN'
  | 'FACULTY'
  | 'STUDENT'
  | 'MAINTENANCE_STAFF'
  | 'SECURITY_STAFF';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  roleName: Extract<RoleName, 'STUDENT' | 'FACULTY' | 'MAINTENANCE_STAFF' | 'SECURITY_STAFF'>;
  departmentId?: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setAccessToken: (token: string | null) => void;
  hasRole: (role: RoleName) => boolean;
  hasAnyRole: (roles: RoleName[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessTokenState] = useState<string | null>(
    localStorage.getItem('accessToken'),
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const setAccessToken = useCallback((token: string | null) => {
    setAccessTokenState(token);
    if (token) {
      localStorage.setItem('accessToken', token);
    } else {
      localStorage.removeItem('accessToken');
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (!localStorage.getItem('accessToken')) return;
    const res = await api.get('/auth/me');
    setUser(res.data.data);
  }, []);

  useEffect(() => {
    const onTokenRefreshed = (event: Event) => {
      const detail = (event as CustomEvent<{ token: string | null }>).detail;
      if (detail && 'token' in detail) {
        setAccessToken(detail.token);
      }
    };
    window.addEventListener('auth:token-refreshed', onTokenRefreshed);
    return () => window.removeEventListener('auth:token-refreshed', onTokenRefreshed);
  }, [setAccessToken]);

  useEffect(() => {
    const fetchMe = async () => {
      if (!accessToken) {
        setIsLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.data);
      } catch {
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
  }, [accessToken, setAccessToken]);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: userData, tokens } = res.data.data;
    setUser(userData);
    setAccessToken(tokens.accessToken);
  };

  const register = async (input: RegisterInput) => {
    const res = await api.post('/auth/register', input);
    const { user: userData, tokens } = res.data.data;
    setUser(userData);
    setAccessToken(tokens.accessToken);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    } finally {
      disconnectSocket();
      setUser(null);
      setAccessToken(null);
      queryClient.clear();
    }
  };

  const hasRole = (role: RoleName): boolean => {
    return user?.roles?.includes(role) ?? false;
  };

  const hasAnyRole = (roles: RoleName[]): boolean => {
    if (!user || !user.roles) return false;
    return roles.some((r) => user.roles.includes(r));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        setAccessToken,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
