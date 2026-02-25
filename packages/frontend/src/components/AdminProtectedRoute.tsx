import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "@/context/AdminAuthContext";

const AdminProtectedRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAdminAuth();

  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/admin" replace />;

  return <Outlet />;
};

export default AdminProtectedRoute;
