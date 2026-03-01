import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  adminLogin as apiAdminLogin,
  adminVerifyOtp as apiAdminVerifyOtp,
  adminResendOtp as apiAdminResendOtp,
  AdminOtpResponse,
} from "@/services/adminApi";

interface AdminAuthContextType {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  resendOtp: () => Promise<number>;
  logout: () => void;
  loading: boolean;
  otpPending: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

export const AdminAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [otpPending, setOtpPending] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem("adminToken");
    setIsAuthenticated(false);
    setOtpPending(false);
    setSessionToken(null);
    navigate("/admin");
  }, [navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("adminToken");
    if (stored) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  // Auto-logout on 401 from any admin API call
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("admin-auth-error", handler);
    return () => window.removeEventListener("admin-auth-error", handler);
  }, [logout]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await apiAdminLogin(email, password);
      if ("otp_required" in res) {
        const otpRes = res as AdminOtpResponse;
        setSessionToken(otpRes.session_token);
        setOtpPending(true);
      } else {
        localStorage.setItem("adminToken", res.token);
        setIsAuthenticated(true);
        navigate("/admin/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    if (!sessionToken) throw new Error("No session token");
    setLoading(true);
    try {
      const res = await apiAdminVerifyOtp(sessionToken, code);
      localStorage.setItem("adminToken", res.token);
      setIsAuthenticated(true);
      setOtpPending(false);
      setSessionToken(null);
      navigate("/admin/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async (): Promise<number> => {
    if (!sessionToken) throw new Error("No session token");
    const res = await apiAdminResendOtp(sessionToken);
    return res.resends_remaining;
  };

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, login, verifyOtp, resendOtp, logout, loading, otpPending }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAdminAuth = () => {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
};
