import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
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

  useEffect(() => {
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('authUser'); // Assuming you'll store user data too

    if (storedToken && storedUser) {
      try {
        const parsedUser: api.UserProfileResponse = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        setIsAuthenticated(true);
      } catch (error) {
        console.error("Failed to parse stored user data:", error);
        // Clear invalid data
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
      }
    }
    setLoading(false);
  }, []);

  const login = async (credentials: api.BrandLoginRequest) => {
    setLoading(true);
    try {
      const response = await api.brandLogin(credentials);
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('authUser', JSON.stringify(response.user)); // Store user data
      setToken(response.token);
      setUser(response.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Login failed:", error);
      throw error; // Re-throw to allow component to handle
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
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
