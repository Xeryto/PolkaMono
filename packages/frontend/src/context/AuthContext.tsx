import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '@/services/api'; // Import your API service

interface AuthContextType {
  isAuthenticated: boolean;
  user: api.UserProfileResponse | null;
  token: string | null;
  login: (credentials: api.BrandLoginRequest) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<api.UserProfileResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    navigate('/portal');
  }, [navigate]);

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser');

    if (storedToken && storedUser) {
      try {
        const parsedUser: api.UserProfileResponse = JSON.parse(storedUser);
        if (parsedUser.is_brand) {
          setToken(storedToken);
          setUser(parsedUser);
          setIsAuthenticated(true);
        } else {
          logout();
        }
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        logout();
      }
    }
    setLoading(false);

    const handleAuthError = () => {
      logout();
    };

    window.addEventListener('auth-error', handleAuthError);

    return () => {
      window.removeEventListener('auth-error', handleAuthError);
    };
  }, [logout]);

  const login = async (credentials: api.BrandLoginRequest) => {
    setLoading(true);
    try {
      const response = await api.brandLogin(credentials);
      if (response.user.is_brand) {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('authUser', JSON.stringify(response.user));
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
      } else {
        throw new Error("User is not a brand.");
      }
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
