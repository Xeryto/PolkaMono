import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin as apiAdminLogin } from "@/services/adminApi";

interface AdminAuthContextType {
  isAuthenticated: boolean;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem("adminToken");
    setToken(null);
    setIsAuthenticated(false);
    navigate("/admin");
  }, [navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("adminToken");
    if (stored) {
      setToken(stored);
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiAdminLogin(email, password);
      localStorage.setItem("adminToken", res.token);
      setToken(res.token);
      setIsAuthenticated(true);
      navigate("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, token, login, logout, loading }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
};
