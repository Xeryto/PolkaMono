import { useState, useEffect } from 'react';
import { sessionManager, SessionEvent } from '../services/api';

interface SessionState {
  isAuthenticated: boolean;
  isEmailVerified: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useSession = () => {
  const [sessionState, setSessionState] = useState<SessionState>({
    isAuthenticated: false,
    isEmailVerified: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Check initial authentication status
    const checkAuthStatus = async () => {
      try {
        const isAuth = await sessionManager.isAuthenticated();
        const user = await sessionManager.getCurrentUser();
        setSessionState({
          isAuthenticated: isAuth,
          isEmailVerified: user?.is_email_verified || false,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setSessionState({
          isAuthenticated: false,
          isEmailVerified: false,
          isLoading: false,
          error: 'Failed to check authentication status',
        });
      }
    };

    checkAuthStatus();

    // Listen for session events
    const unsubscribe = sessionManager.addListener((event: SessionEvent) => {
      switch (event) {
        case 'token_expired':
          setSessionState(prev => ({
            ...prev,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expired. Please log in again.',
          }));
          break;
        case 'token_refreshed':
          setSessionState(prev => ({
            ...prev,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          }));
          break;
        case 'session_cleared':
          setSessionState(prev => ({
            ...prev,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          }));
          break;
        case 'login_required':
          setSessionState(prev => ({
            ...prev,
            isAuthenticated: false,
            isLoading: false,
            error: 'Please log in to continue.',
          }));
          break;
      }
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      setSessionState(prev => ({ ...prev, isLoading: true }));
      await sessionManager.clearSession();
      setSessionState(prev => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to logout',
      }));
    }
  };

  const clearError = () => {
    setSessionState(prev => ({ ...prev, error: null }));
  };

  const login = async () => {
    try {
      const user = await sessionManager.getCurrentUser();
      setSessionState({
        isAuthenticated: true,
        isEmailVerified: user?.is_email_verified || false,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      setSessionState(prev => ({
        ...prev,
        isAuthenticated: true, // Still authenticated, but couldn't fetch profile
        isLoading: false,
        error: 'Failed to fetch user profile after login',
      }));
    }
  };

  return {
    ...sessionState,
    login,
    logout,
    clearError,
  };
}; 