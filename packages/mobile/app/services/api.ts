import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, handleApiResponse } from './apiHelpers';

// API configuration
const API_URL = API_CONFIG.API_BASE_URL;
console.log(API_URL);
const USER_PROFILE_KEY = 'PolkaMobile_userProfile';

// Session management events
export type SessionEvent = 'token_expired' | 'token_refreshed' | 'session_cleared' | 'login_required';

// Session event listener type
export type SessionEventListener = (event: SessionEvent) => void;

// Add session state tracking
export enum SessionState {
  UNKNOWN = 'unknown',
  VALID = 'valid',
  EXPIRED = 'expired',
  REFRESHING = 'refreshing'
}

// Session manager class
class SessionManager {
  private listeners: SessionEventListener[] = [];
  private isRefreshing = false;
  private refreshPromise: Promise<string> | null = null;
  private sessionState: SessionState = SessionState.UNKNOWN;
  private logoutInProgress = false;

  // Add event listener
  addListener(listener: SessionEventListener) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Emit event to all listeners
  private emit(event: SessionEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  // Check if token is expired or will expire soon (within 5 minutes)
  private isTokenExpiredOrExpiringSoon(expiryDate: Date): boolean {
    const now = new Date();
    const timeUntilExpiry = expiryDate.getTime() - now.getTime();
    return timeUntilExpiry <= 5 * 60 * 1000; // 5 minutes
  }

  // Refresh token
  async refreshToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.sessionState = SessionState.REFRESHING;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const newToken = await this.refreshPromise;
      this.sessionState = SessionState.VALID;
      this.emit('token_refreshed');
      return newToken;
    } catch (error) {
      this.sessionState = SessionState.EXPIRED;
      this.handleSessionExpiration();
      throw error;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async performTokenRefresh(): Promise<string> {
    try {
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      console.log('Attempting to refresh token with:', refreshToken);
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      console.log('Refresh token response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Refresh token failed with error:', errorData);
        throw new Error('Token refresh failed');
      }
      const data = await response.json();
      console.log('Refresh token successful. New token data:', data);
      await this.storeSession(data.token, data.expires_at, data.refresh_token);
      return data.token;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  // Store session
  async storeSession(token: string, expiresAt: string, refreshToken?: string) {
    try {
      console.log('Storing session: token (first 10 chars)=', token.substring(0, 10), '..., expiresAt=', expiresAt, 'refreshToken (first 10 chars)=', refreshToken?.substring(0, 10));
      await SecureStore.setItemAsync('authToken', token);
      await AsyncStorage.setItem('tokenExpiry', expiresAt); // Expiry can remain in AsyncStorage
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }
      this.sessionState = SessionState.VALID;
      console.log('Session stored successfully.');
    } catch (error) {
      console.error('Error storing session:', error);
    }
  }

  // Get current session with automatic refresh
  async getValidSession(): Promise<{ token: string | null, isValid: boolean }> {
    try {
      // If we know session is expired, don't even try
      if (this.sessionState === SessionState.EXPIRED) {
        return { token: null, isValid: false };
      }

      const token = await SecureStore.getItemAsync('authToken');
      const expiryStr = await AsyncStorage.getItem('tokenExpiry');

      if (!token || !expiryStr) {
        this.sessionState = SessionState.EXPIRED;
        return { token: null, isValid: false };
      }

      const expiryDate = new Date(expiryStr);
      
      if (this.isTokenExpiredOrExpiringSoon(expiryDate)) {
        // Try to refresh the token
        try {
          const newToken = await this.refreshToken();
          return { token: newToken, isValid: true };
        } catch (error) {
          this.sessionState = SessionState.EXPIRED;
          this.handleSessionExpiration();
          return { token: null, isValid: false };
        }
      }

      this.sessionState = SessionState.VALID;
      return { token, isValid: true };
    } catch (error) {
      console.error('Error getting valid session:', error);
      this.sessionState = SessionState.EXPIRED;
      return { token: null, isValid: false };
    }
  }

  // Clear session
  async clearSession() {
    if (this.logoutInProgress) return; // Prevent multiple simultaneous logouts
    
    this.logoutInProgress = true;
    try {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await AsyncStorage.multiRemove(['tokenExpiry', 'userProfile']);
      this.sessionState = SessionState.EXPIRED;
      this.emit('session_cleared');
    } catch (error) {
      console.error('Error clearing session:', error);
    } finally {
      this.logoutInProgress = false;
    }
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const { isValid } = await this.getValidSession();
    return isValid;
  }

  // Public method to handle login required
  handleLoginRequired() {
    console.log('handleLoginRequired called. Current session state:', this.sessionState);
    if (this.sessionState !== SessionState.EXPIRED) {
      console.log('Emitting login_required event.');
      this.sessionState = SessionState.EXPIRED;
      this.emit('login_required');
    } else {
      console.log('Login already required, not re-emitting.');
    }
  }

  private handleSessionExpiration() {
    if (!this.logoutInProgress) {
      this.handleLoginRequired();
    }
  }

  getSessionState(): SessionState {
    return this.sessionState;
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    return await retrieveUserProfile();
  }
}

// Create global session manager instance
export const sessionManager = new SessionManager();

// Updated User profile interfaces to match new API
export interface UserProfile {
  id: string;
  username: string;
  email: string;
  gender?: 'male' | 'female';
  selected_size?: string;
  avatar_url?: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_brand: boolean;
  created_at: string;
  updated_at: string;
  favorite_brands?: Brand[];
  favorite_styles?: Style[];
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: UserProfile;
}

export interface ProfileCompletionStatus {
  isComplete: boolean;
  missingFields: string[];
  requiredScreens: ('confirmation' | 'brand_selection' | 'style_selection')[];
}

// Email Verification API functions
export const requestVerificationEmail = async (): Promise<{ message: string }> => {
  console.log("requesting email");
  return await apiRequest('/api/v1/auth/request-verification', 'POST');
}; 

// OAuth interfaces
export interface OAuthProvider {
  provider: string;
  client_id: string;
  redirect_url: string;
  scope: string;
}

export interface OAuthLoginRequest {
  provider: string;
  token: string;
}

// Product interfaces (keeping existing ones)
export interface Product {
  id: string; // Changed from number to string
  name: string;
  description?: string;
  price: string;
  images: string[]; // Changed to string[]
  honest_sign?: string;
  color?: string;
  material?: string;
  hashtags?: string[];
  brand_id: number;
  category_id: string;
  styles: string[];
  variants?: { size: string; stock_quantity: number; }[]; // Added variants
  return_policy?: string; // NEW
  brand_name?: string; // NEW
  brand_return_policy?: string; // NEW
  is_liked?: boolean; // Only for user-specific recommendations/favorites
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logo: string;
  description: string;
}

export interface Style {
  id: string;
  name: string;
  description: string;
  image: string;
}





// API request helper with automatic token refresh
const apiRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  requireAuth: boolean = true
) => {
  try {
    let token: string | null = null;
    let isValid = false;

    // Only check session if authentication is required
    if (requireAuth) {
      const session = await sessionManager.getValidSession();
      token = session.token;
      isValid = session.isValid;
      
      if (!isValid) {
        sessionManager.handleLoginRequired();
        throw new ApiError('Authentication required', 401);
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
      console.log('API Request: Received 401 status.');
      // Only trigger logout once per request and only if auth was required
      if (requireAuth) {
        console.log('API Request: Authentication required, triggering handleLoginRequired.');
        sessionManager.handleLoginRequired();
      }
      throw new ApiError('Authentication required', 401);
    }

    return await handleApiResponse(response);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Don't show authentication errors to users, just log them
      console.log('API authentication error:', error.message);
    }
    throw error;
  }
};

// Legacy functions for backward compatibility
export const storeSession = async (token: string, expiresAt: string, refreshToken?: string) => {
  await sessionManager.storeSession(token, expiresAt, refreshToken);
};

export const getSession = async (): Promise<{ token: string | null, isValid: boolean }> => {
  return await sessionManager.getValidSession();
};

export const clearSession = async () => {
  await sessionManager.clearSession();
};

// User profile persistence
export const storeUserProfile = async (profile: UserProfile) => {
  try {
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('Error storing user profile:', error);
    throw error;
  }
};

export const retrieveUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const profileString = await AsyncStorage.getItem(USER_PROFILE_KEY);
    return profileString ? JSON.parse(profileString) : null;
  } catch (error) {
    console.error('Error retrieving user profile:', error);
    return null;
  }
};

// Updated Authentication API functions
export const registerUser = async (
  username: string,
  email: string,
  password: string,
  gender?: 'male' | 'female', // Changed
  selected_size?: string, // Changed
  avatar_url?: string // Changed
): Promise<AuthResponse> => {
  const response = await apiRequest('/api/v1/auth/register', 'POST', {
    username,
    email,
    password,
    gender,
    selected_size,
    avatar_url
  }, false);

  // Store session
  await sessionManager.storeSession(
    response.token,
    response.expires_at
  );

  // Store user profile, explicitly setting is_email_verified to false for new registrations
  // This ensures the CheckYourEmailScreen is shown after signup until actual verification.
  await storeUserProfile({ ...response.user, is_email_verified: false });

  return response;
};

export const loginUser = async (
  identifier: string, // Can be username or email
  password: string
): Promise<AuthResponse> => {
  console.log("here")
  const response = await apiRequest('/api/v1/auth/login', 'POST', {
    identifier, // Backend should handle both username and email
    password
  }, false);

  console.log(response);

  // Store session
  await sessionManager.storeSession(
    response.token,
    response.expires_at
  );

  // Store user profile
  await storeUserProfile(response.user);
  
  return response;
};

export const logoutUser = async (): Promise<void> => {
  try {
    // Call logout endpoint to invalidate tokens on server
    await apiRequest('/api/v1/auth/logout', 'POST');
  } catch (error) {
    console.error('Error calling logout endpoint:', error);
    // Continue with local logout even if server call fails
  } finally {
    // Always clear local session
    await sessionManager.clearSession();
  }
};

export const refreshAuthToken = async (refreshToken: string): Promise<AuthResponse> => {
    return await apiRequest('/api/v1/auth/refresh', 'POST', {
        refresh_token: refreshToken
    }, false);
}

// OAuth functions
export const getOAuthProviders = async (): Promise<OAuthProvider[]> => {
  return await apiRequest('/api/v1/auth/oauth/providers', 'GET', undefined, false);
};

export const oauthLogin = async (provider: string, token: string): Promise<AuthResponse> => {
  const response = await apiRequest('/api/v1/auth/oauth/login', 'POST', {
    provider,
    token
  }, false);

  // Store session
  await sessionManager.storeSession(
    response.token,
    response.expires_at
  );

  // Store user profile
  await storeUserProfile(response.user);

  return response;
};

// Updated User profile API functions
export const getCurrentUser = async (): Promise<UserProfile> => {
  const response: UserProfile = await apiRequest('/api/v1/user/profile', 'GET');
  await storeUserProfile(response); // Update stored profile
  return response;
};

export const getProfileCompletionStatus = async (): Promise<ProfileCompletionStatus> => {
  return await apiRequest('/api/v1/user/profile/completion-status', 'GET');
};

export const getOAuthAccounts = async (): Promise<any[]> => {
  return await apiRequest('/api/v1/user/oauth-accounts', 'GET');
};

// NEW: User preference update functions
export const updateUserProfile = async (
  profileData: Partial<UserProfile> // Use Partial to allow partial updates
): Promise<UserProfile> => {
  const response = await apiRequest('/api/v1/user/profile', 'PUT', profileData);
  
  // Update stored profile
  await storeUserProfile(response);
  
  return response;
};

export const updateUserBrands = async (brandIds: number[]): Promise<any> => {
  const response = await apiRequest('/api/v1/user/brands', 'POST', {
    brand_ids: brandIds
  });
  
  // Refresh user profile to get updated data
  const updatedProfile = await getCurrentUser();
  await storeUserProfile(updatedProfile);
  
  return response;
};

export const updateUserStyles = async (styleIds: string[]): Promise<any> => {
  const response = await apiRequest('/api/v1/user/styles', 'POST', {
    style_ids: styleIds
  });
  
  // Refresh user profile to get updated data
  const updatedProfile = await getCurrentUser();
  await storeUserProfile(updatedProfile);
  
  return response;
};

// NEW: Brand and Style API functions
export const getBrands = async (): Promise<Brand[]> => {
  return await apiRequest('/api/v1/brands', 'GET', undefined, false);
};

export const getStyles = async (): Promise<Style[]> => {
  return await apiRequest('/api/v1/styles', 'GET', undefined, false);
};

// Friends interfaces
export interface FriendRequest {
  id: string;
  recipient?: {
    id: string;
    username: string;
  };
  sender?: {
    id: string;
    username: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
}

export interface Friend {
  id: string;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
}

export interface SearchUser {
  id: string;
  username: string;
  email: string;
  avatar_url?: string | null;
  friend_status?: 'friend' | 'request_received' | 'request_sent' | 'not_friend';
}

export interface FriendRequestResponse {
  message: string;
  request_id?: string; // Add optional request_id field
}

// Friends API functions
export const sendFriendRequest = async (recipientUsername: string): Promise<FriendRequestResponse> => {
  console.log('Sending friend request to username:', recipientUsername);
  const requestBody = {
    recipient_identifier: recipientUsername
  };
  console.log('Request body:', JSON.stringify(requestBody, null, 2));
  
  return await apiRequest('/api/v1/friends/request', 'POST', requestBody);
};

export const getSentFriendRequests = async (): Promise<FriendRequest[]> => {
  return await apiRequest('/api/v1/friends/requests/sent', 'GET');
};

export const getReceivedFriendRequests = async (): Promise<FriendRequest[]> => {
  return await apiRequest('/api/v1/friends/requests/received', 'GET');
};

export const acceptFriendRequest = async (requestId: string): Promise<FriendRequestResponse> => {
  return await apiRequest(`/api/v1/friends/requests/${requestId}/accept`, 'POST');
};

export const rejectFriendRequest = async (requestId: string): Promise<FriendRequestResponse> => {
  return await apiRequest(`/api/v1/friends/requests/${requestId}/reject`, 'POST');
};

export const cancelFriendRequest = async (requestId: string): Promise<FriendRequestResponse> => {
  return await apiRequest(`/api/v1/friends/requests/${requestId}/cancel`, 'DELETE');
};

export const getFriends = async (): Promise<Friend[]> => {
  return await apiRequest('/api/v1/friends', 'GET');
};

export const searchUsers = async (query: string): Promise<SearchUser[]> => {
  if (query.length < 2) {
    return [];
  }
  return await apiRequest(`/api/v1/users/search?query=${encodeURIComponent(query)}`, 'GET');
};

// Public user profile interface
export interface PublicUserProfile {
  id: string;
  username: string;
  gender: 'male' | 'female' | null;
}

// Get public profile of another user
export const getUserPublicProfile = async (userId: string): Promise<PublicUserProfile> => {
  return await apiRequest(`/api/v1/users/${userId}/profile`, 'GET');
};

// Remove a friend
export const removeFriend = async (friendId: string): Promise<FriendRequestResponse> => {
  return await apiRequest(`/api/v1/friends/${friendId}`, 'DELETE');
};

// Health check
export const healthCheck = async (): Promise<any> => {
  return await apiRequest('/health', 'GET', undefined, false);
};

export const requestPasswordReset = async (email: string): Promise<void> => {
  await apiRequest('/api/v1/auth/forgot-password', 'POST', { email }, false);
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await apiRequest('/api/v1/auth/reset-password', 'POST', { token, password }, false);
};

export const verifyEmail = async (token: string): Promise<void> => {
  await apiRequest('/api/v1/auth/verify-email', 'POST', { token }, false);
};

// Password reset simulation
export const simulateResetPassword = async (usernameOrEmail: string): Promise<boolean> => {
  try {
    // Simulate API call for password reset
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true; // Always return true for simulation
  } catch (error) {
    console.error('Error simulating password reset:', error);
    return false;
  }
};



// Get all categories
export const getCategories = async (): Promise<any[]> => {
  return await apiRequest('/api/v1/categories', 'GET', undefined, false);
};

// Payment API functions
export interface Amount {
  value: string;
  currency: string;
}

export interface ReceiptItem {
  product_id: string;
  //quantity: number;
  size: string;
}

export interface ReceiptCustomer {
  full_name?: string;
  email?: string;
  phone?: string;
}

export interface PaymentCreateRequest {
  amount: Amount;
  description: string;
  items: ReceiptItem[];
  returnUrl: string;
}

export interface PaymentCreateResponse {
  confirmation_url: string;
  payment_id: string;
}

export const createPayment = async (paymentDetails: PaymentCreateRequest): Promise<PaymentCreateResponse> => {
  console.log(paymentDetails)
  const response = await apiRequest('/api/v1/payments/create', 'POST', paymentDetails);
  return response as PaymentCreateResponse;
};

export interface PaymentStatusResponse {
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
}

export const getPaymentStatus = async (paymentId: string): Promise<PaymentStatusResponse> => {
  return await apiRequest(`/api/v1/payments/status?payment_id=${paymentId}`, 'GET');
};

// Order History

// Get user's favorite products
export const getUserFavorites = async (): Promise<Product[]> => {
  return await apiRequest('/api/v1/user/favorites', 'GET');
};

// Get recommendations for a friend
export const getFriendRecommendations = async (friendId: string): Promise<Product[]> => {
  return await apiRequest(`/api/v1/friends/${friendId}/recommendations`, 'GET');
};

// Get recommendations for the current user
export const getUserRecommendations = async (): Promise<Product[]> => {
  return await apiRequest('/api/v1/recommendations/for_user', 'GET');
};

export const toggleFavorite = async (productId: string, action: 'like' | 'unlike'): Promise<{ message: string }> => {
  return await apiRequest('/api/v1/user/favorites/toggle', 'POST', {
    product_id: productId,
    action: action,
  });
};

export interface OrderItem {
  id: string;
  name: string;
  price: string;
  size: string;
  image: string;
  delivery: {
    cost: string;
    estimatedTime: string;
    tracking_number?: string;
  };
}

export interface Order {
  id: string;
  number: string;
  total: string;
  date: string; // datetime is a string in JSON
  status: string;
  tracking_number?: string;
  tracking_link?: string;
  items: OrderItem[];
}

export const getOrders = async (): Promise<Order[]> => {
  return await apiRequest('/api/v1/orders', 'GET');
};

export const getProductSearchResults = async (params: {
  query?: string;
  category?: string;
  brand?: string;
  style?: string;
  limit?: number;
  offset?: number;
}): Promise<Product[]> => {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.append('query', params.query);
  if (params.category && params.category !== 'Категория') searchParams.append('category', params.category);
  if (params.brand && params.brand !== 'Бренд') searchParams.append('brand', params.brand);
  if (params.style && params.style !== 'Стиль') searchParams.append('style', params.style);
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.offset) searchParams.append('offset', params.offset.toString());

  return await apiRequest(`/api/v1/products/search?${searchParams.toString()}`, 'GET');
};
