import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const ProtectedRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div>Loading...</div>; // Or a spinner component
  }

  if (!isAuthenticated || !user?.is_brand) {
    return <Navigate to="/portal" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
