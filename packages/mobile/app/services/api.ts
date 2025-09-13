import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from './config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError, handleApiResponse } from './apiHelpers';
import { 
  fetchWithTimeoutAndRetry, 
  getNetworkErrorMessage, 
  isRetryableError,
  RequestOptions 
} from './networkUtils';

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
  private userProfileCache: UserProfile | null = null;
  private userProfileCacheTime: number = 0;
  private readonly USER_CACHE_DURATION = 30 * 1000; // 30 seconds

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
      
      // Clear user profile cache
      this.userProfileCache = null;
      this.userProfileCacheTime = 0;
      
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
    const now = Date.now();
    
    // Return cached user profile if it's still fresh
    if (this.userProfileCache && (now - this.userProfileCacheTime) < this.USER_CACHE_DURATION) {
      console.log('Returning cached user profile from session manager');
      return this.userProfileCache;
    }
    
    console.log('Fetching fresh user profile from session manager');
    const user = await retrieveUserProfile();
    
    // Cache the result
    this.userProfileCache = user;
    this.userProfileCacheTime = now;
    
    return user;
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
  price: number;
  images: string[]; // Changed to string[]
  honest_sign?: string;
  color?: string;
  material?: string;
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





// API request helper with automatic token refresh, timeout, and retry logic
const apiRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  requireAuth: boolean = true,
  requestOptions: RequestOptions = {}
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
        throw new ApiError('Требуется аутентификация. Пожалуйста, войдите в систему.', 401);
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Use the enhanced fetch with timeout and retry logic
    const response = await fetchWithTimeoutAndRetry(
      `${API_URL}${endpoint}`,
      {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      },
      {
        ...requestOptions,
        // Use API config timeout if not specified
        timeout: requestOptions.timeout ?? API_CONFIG.PROD.API_TIMEOUT,
      }
    );

    if (response.status === 401) {
      console.log('API Request: Received 401 status.');
      // Only trigger logout once per request and only if auth was required
      if (requireAuth) {
        console.log('API Request: Authentication required, triggering handleLoginRequired.');
        sessionManager.handleLoginRequired();
      }
      // Let the actual API error message come through instead of generic message
      return await handleApiResponse(response);
    }

    return await handleApiResponse(response);
  } catch (error) {
    // Handle network errors with user-friendly messages
    if (isRetryableError(error as Error)) {
      const friendlyMessage = getNetworkErrorMessage(error as Error);
      throw new ApiError(friendlyMessage, 0); // Use 0 status for network errors
    }
    
    if (error instanceof ApiError && error.status === 401) {
      // Log the authentication error for debugging
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

// Username and email availability checks
export const checkUsernameAvailability = async (username: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/api/v1/auth/check-username/${encodeURIComponent(username)}`, 'GET', null, false);
    return response.available;
  } catch (error) {
    console.error('Error checking username availability:', error);
    return false; // Assume not available on error to be safe
  }
};

export const checkEmailAvailability = async (email: string): Promise<boolean> => {
  try {
    const response = await apiRequest(`/api/v1/auth/check-email/${encodeURIComponent(email)}`, 'GET', null, false);
    return response.available;
  } catch (error) {
    console.error('Error checking email availability:', error);
    return false; // Assume not available on error to be safe
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
  const requestKey = 'getCurrentUser';
  
  // Check if there's already a pending request
  if (pendingRequests.has(requestKey)) {
    console.log('Waiting for existing user profile request');
    return pendingRequests.get(requestKey)!;
  }
  
  console.log('Fetching user profile from API');
  const userPromise = apiRequest('/api/v1/user/profile', 'GET').then(response => {
    // Update stored profile
    storeUserProfile(response);
    // Remove from pending requests
    pendingRequests.delete(requestKey);
    return response;
  }).catch(error => {
    // Remove from pending requests on error
    pendingRequests.delete(requestKey);
    throw error;
  });
  
  // Store the pending request
  pendingRequests.set(requestKey, userPromise);
  
  return userPromise;
};

export const getProfileCompletionStatus = async (): Promise<ProfileCompletionStatus> => {
  const requestKey = 'getProfileCompletionStatus';
  
  // Check if there's already a pending request
  if (pendingRequests.has(requestKey)) {
    console.log('Waiting for existing profile completion status request');
    return pendingRequests.get(requestKey)!;
  }
  
  console.log('Fetching profile completion status from API');
  const completionPromise = apiRequest('/api/v1/user/profile/completion-status', 'GET').then(status => {
    // Remove from pending requests
    pendingRequests.delete(requestKey);
    return status;
  }).catch(error => {
    // Remove from pending requests on error
    pendingRequests.delete(requestKey);
    throw error;
  });
  
  // Store the pending request
  pendingRequests.set(requestKey, completionPromise);
  
  return completionPromise;
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

// Data caching for brands and styles to prevent refetching
let brandsCache: Brand[] | null = null;
let stylesCache: Style[] | null = null;
let brandsCacheTime: number = 0;
let stylesCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Request deduplication to prevent multiple identical requests
const pendingRequests = new Map<string, Promise<any>>();

// NEW: Brand and Style API functions with caching and deduplication
export const getBrands = async (): Promise<Brand[]> => {
  const now = Date.now();
  
  // Return cached data if it's still fresh
  if (brandsCache && (now - brandsCacheTime) < CACHE_DURATION) {
    console.log('Returning cached brands data');
    return brandsCache;
  }
  
  // Check if there's already a pending request
  const requestKey = 'getBrands';
  if (pendingRequests.has(requestKey)) {
    console.log('Waiting for existing brands request');
    return pendingRequests.get(requestKey)!;
  }
  
  console.log('Fetching fresh brands data from API');
  const brandsPromise = apiRequest('/api/v1/brands', 'GET', undefined, false).then(brands => {
    // Cache the result
    brandsCache = brands;
    brandsCacheTime = now;
    // Remove from pending requests
    pendingRequests.delete(requestKey);
    return brands;
  }).catch(error => {
    // Remove from pending requests on error
    pendingRequests.delete(requestKey);
    throw error;
  });
  
  // Store the pending request
  pendingRequests.set(requestKey, brandsPromise);
  
  return brandsPromise;
};

export const getStyles = async (): Promise<Style[]> => {
  const now = Date.now();
  
  // Return cached data if it's still fresh
  if (stylesCache && (now - stylesCacheTime) < CACHE_DURATION) {
    console.log('Returning cached styles data');
    return stylesCache;
  }
  
  // Check if there's already a pending request
  const requestKey = 'getStyles';
  if (pendingRequests.has(requestKey)) {
    console.log('Waiting for existing styles request');
    return pendingRequests.get(requestKey)!;
  }
  
  console.log('Fetching fresh styles data from API');
  const stylesPromise = apiRequest('/api/v1/styles', 'GET', undefined, false).then(styles => {
    // Cache the result
    stylesCache = styles;
    stylesCacheTime = now;
    // Remove from pending requests
    pendingRequests.delete(requestKey);
    return styles;
  }).catch(error => {
    // Remove from pending requests on error
    pendingRequests.delete(requestKey);
    throw error;
  });
  
  // Store the pending request
  pendingRequests.set(requestKey, stylesPromise);
  
  return stylesPromise;
};

// Clear cache function for when user logs out
export const clearDataCache = () => {
  brandsCache = null;
  stylesCache = null;
  brandsCacheTime = 0;
  stylesCacheTime = 0;
  pendingRequests.clear();
  console.log('Data cache and pending requests cleared');
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

export const requestPasswordReset = async (identifier: string): Promise<void> => {
  await apiRequest('/api/v1/auth/forgot-password', 'POST', { identifier }, false);
};

export const resetPassword = async (token: string, password: string): Promise<void> => {
  await apiRequest('/api/v1/auth/reset-password', 'POST', { token, password }, false);
};

export const resetPasswordWithCode = async (identifier: string, code: string, password: string): Promise<void> => {
  await apiRequest('/api/v1/auth/reset-password-with-code', 'POST', { identifier, code, new_password: password }, false);
};

// Validate password reset code with backend
export const validatePasswordResetCode = async (identifier: string, code: string): Promise<void> => {
  await apiRequest('/api/v1/auth/validate-password-reset-code', 'POST', { identifier, code }, false);
};

export const verifyEmail = async (code: string): Promise<void> => {
  // Get current user to get email
  const user = await getCurrentUser();
  await apiRequest('/api/v1/auth/verify-email', 'POST', { email: user.email, code }, false);
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
  value: number;
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
  return await apiRequest(`/api/v1/recommendations/for_friend/${friendId}`, 'GET');
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
  price: number;
  size: string;
  image: string;
  delivery: {
    cost: number;
    estimatedTime: string;
    tracking_number?: string;
  };
}

export interface Order {
  id: string;
  number: string;
  total_amount: number;
  currency: string;
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

// User Statistics
export interface UserStats {
  items_purchased: number;
  items_swiped: number;
  total_orders: number;
  account_age_days: number;
}

export const getUserStats = async (): Promise<UserStats> => {
  return await apiRequest('/api/v1/user/stats', 'GET');
};

// Swipe Tracking
export interface SwipeTrackingRequest {
  product_id: string;
  swipe_direction: 'left' | 'right';
}

export const trackUserSwipe = async (swipeData: SwipeTrackingRequest): Promise<{ message: string }> => {
  return await apiRequest('/api/v1/user/swipe', 'POST', swipeData);
};

// Session storage for swipe tracking
const SWIPE_COUNT_KEY = 'PolkaMobile_swipeCount';
const PENDING_SWIPES_KEY = 'PolkaMobile_pendingSwipes';

// Initialize swipe count from API
export const initializeSwipeCount = async (): Promise<number> => {
  try {
    const stats = await getUserStats();
    const swipeCount = stats.items_swiped;
    
    // Store in session storage
    await AsyncStorage.setItem(SWIPE_COUNT_KEY, swipeCount.toString());
    console.log('Initialized swipe count from API:', swipeCount);
    
    return swipeCount;
  } catch (error) {
    console.error('Error initializing swipe count:', error);
    // Fallback to 0 if API fails
    await AsyncStorage.setItem(SWIPE_COUNT_KEY, '0');
    return 0;
  }
};

// Get current swipe count from session storage
export const getCurrentSwipeCount = async (): Promise<number> => {
  try {
    const count = await AsyncStorage.getItem(SWIPE_COUNT_KEY);
    return count ? parseInt(count, 10) : 0;
  } catch (error) {
    console.error('Error getting swipe count:', error);
    return 0;
  }
};

// Increment swipe count optimistically
export const incrementSwipeCount = async (): Promise<number> => {
  try {
    const currentCount = await getCurrentSwipeCount();
    const newCount = currentCount + 1;
    await AsyncStorage.setItem(SWIPE_COUNT_KEY, newCount.toString());
    console.log('Incremented swipe count to:', newCount);
    return newCount;
  } catch (error) {
    console.error('Error incrementing swipe count:', error);
    return 0;
  }
};

// Decrement swipe count (for rollback)
export const decrementSwipeCount = async (): Promise<number> => {
  try {
    const currentCount = await getCurrentSwipeCount();
    const newCount = Math.max(0, currentCount - 1);
    await AsyncStorage.setItem(SWIPE_COUNT_KEY, newCount.toString());
    console.log('Decremented swipe count to:', newCount);
    return newCount;
  } catch (error) {
    console.error('Error decrementing swipe count:', error);
    return 0;
  }
};

// Track swipe with optimistic updates and rollback
export const trackSwipeWithOptimisticUpdate = async (swipeData: SwipeTrackingRequest): Promise<{ success: boolean; newCount: number }> => {
  try {
    // 1. Optimistically increment the count
    const newCount = await incrementSwipeCount();
    
    // 2. Send to API
    await trackUserSwipe(swipeData);
    
    console.log('Swipe tracked successfully, count:', newCount);
    return { success: true, newCount };
    
  } catch (error) {
    console.error('Error tracking swipe, rolling back:', error);
    
    // 3. Rollback on failure
    const rollbackCount = await decrementSwipeCount();
    
    return { success: false, newCount: rollbackCount };
  }
};
