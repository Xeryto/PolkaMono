import * as SecureStore from 'expo-secure-store';
import { API_CONFIG, log } from './config';
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
log.info(`API URL configured: ${API_URL}`);
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
      await AsyncStorage.multiRemove([
        'tokenExpiry', 
        'userProfile',
        'PolkaMobile_userProfile',
        'PolkaMobile_isLoggedIn',
        'PolkaMobile_authToken',
        'PolkaMobile_userData',
        '@PolkaMobile:cartItems',
        'PolkaMobile_swipeCount',
        'PolkaMobile_pendingSwipes'
      ]);
      
      // Clear cart data when session is cleared
      try {
        const { clearCart } = await import('../cartStorage');
        await clearCart();
        console.log('SessionManager - Cart cleared during session clear');
      } catch (cartError) {
        console.error('Error clearing cart during session clear:', cartError);
      }
      
      // Clear user profile cache
      this.userProfileCache = null;
      this.userProfileCacheTime = 0;
      
      // Clear global caches to prevent cross-user contamination
      clearGlobalCaches();
      
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
    // Always set state to EXPIRED and emit event, even if already expired
    // This ensures listeners always get notified, even if they were set up late
    if (this.sessionState !== SessionState.EXPIRED) {
      this.sessionState = SessionState.EXPIRED;
    }
    console.log('Emitting login_required event.');
    this.emit('login_required');
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
  is_active: boolean;
  is_email_verified: boolean;
  is_brand: boolean;
  created_at: string;
  updated_at: string;
  favorite_brands?: Brand[];
  favorite_styles?: Style[];
  profile?: {
    full_name?: string;
    gender?: 'male' | 'female';
    selected_size?: string;
    avatar_url?: string;
    avatar_url_full?: string;
    avatar_crop?: string;
    avatar_transform?: string;
  };
  shipping_info?: {
    delivery_email?: string;
    phone?: string;
    street?: string;
    house_number?: string;
    apartment_number?: string;
    city?: string;
    postal_code?: string;
  };
  preferences?: {
    size_privacy?: 'nobody' | 'friends' | 'everyone';
    recommendations_privacy?: 'nobody' | 'friends' | 'everyone';
    likes_privacy?: 'nobody' | 'friends' | 'everyone';
    order_notifications?: boolean;
    marketing_notifications?: boolean;
  };
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

// Product interfaces: product has color_variants (each with images and size/stock)
export interface ProductVariantApi {
  id?: string;
  size: string;
  stock_quantity: number;
}

export interface ProductColorVariantApi {
  id?: string;
  color_name: string;
  color_hex: string;
  images: string[];
  variants: ProductVariantApi[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  material?: string;
  brand_id: string;
  category_id: string;
  styles: string[];
  color_variants: ProductColorVariantApi[];
  brand_name?: string;
  brand_return_policy?: string;
  article_number?: string;
  is_liked?: boolean;
  general_images?: string[];
  sale_price?: number | null;
  sale_type?: "percent" | "exact" | null;
  sizing_table_image?: string | null;
  delivery_time_min?: number | null;
  delivery_time_max?: number | null;
  country_of_manufacture?: string | null;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo: string;
  description: string;
  shipping_price?: number;
  min_free_shipping?: number;
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
        timeout: requestOptions.timeout ?? API_CONFIG.API_TIMEOUT,
      }
    );

    if (response.status === 401) {
      console.log('API Request: Received 401 status.');
      // Try refreshing token once before giving up
      if (requireAuth && !requestOptions._isRetryAfterRefresh) {
        try {
          console.log('API Request: Attempting token refresh before logout.');
          await sessionManager.refreshToken();
          return apiRequest(endpoint, method, body, requireAuth, {
            ...requestOptions,
            _isRetryAfterRefresh: true,
          });
        } catch (refreshError) {
          console.log('API Request: Token refresh failed, triggering handleLoginRequired.');
          sessionManager.handleLoginRequired();
          return await handleApiResponse(response);
        }
      }
      if (requireAuth) {
        sessionManager.handleLoginRequired();
      }
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
    response.expires_at,
    response.refresh_token
  );

  // Clear global caches for new user to prevent contamination from previous users
  clearGlobalCaches();

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
    response.expires_at,
    response.refresh_token
  );

  // Clear global caches for new user session to ensure fresh data
  clearGlobalCaches();

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

/** Register Expo push token for the authenticated user (fire-and-forget safe). */
export const registerPushToken = async (token: string): Promise<void> => {
  const session = await sessionManager.getValidSession();
  if (!session || !session.token) return;
  await fetch(`${API_URL}/api/v1/users/push-token`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
};

/** Permanently delete the current user account (anonymizes PII, keeps orders). Clears session on success. */
export const deleteAccount = async (): Promise<void> => {
  await apiRequest('/api/v1/users/me', 'DELETE', undefined, true);
  await sessionManager.clearSession();
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
    response.expires_at,
    response.refresh_token
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
  const userPromise = apiRequest('/api/v1/user/profile', 'GET', undefined, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  }).then(response => {
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
  const completionPromise = apiRequest('/api/v1/user/profile/completion-status', 'GET', undefined, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  }).then(status => {
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
// Update user core (username/email only)
export const updateUserProfile = async (
  profileData: { username?: string; email?: string }
): Promise<UserProfile> => {
  const response = await apiRequest('/api/v1/user/profile', 'PUT', profileData, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  });
  
  // Update stored profile
  await storeUserProfile(response);
  
  return response;
};

// Update user profile data (name, gender, size, avatar)
export interface ProfileData {
  full_name?: string;
  gender?: 'male' | 'female';
  selected_size?: string;
  avatar_url?: string;
  avatar_url_full?: string;
  avatar_crop?: string;
  avatar_transform?: string;
}

export const updateUserProfileData = async (
  profileData: ProfileData
): Promise<ProfileData> => {
  const response = await apiRequest('/api/v1/user/profile/data', 'PUT', profileData, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  });
  
  // Reload full profile to update cache
  const fullProfile = await getCurrentUser();
  await storeUserProfile(fullProfile);
  
  return response;
};

// S3 presigned upload (avatars, product images)
export interface PresignedUploadResponse {
  upload_url: string;
  public_url: string;
  key: string;
}

export const getAvatarPresignedUrl = async (
  contentType: string,
  filename?: string
): Promise<PresignedUploadResponse> => {
  return await apiRequest('/api/v1/user/upload/presigned-url', 'POST', {
    content_type: contentType,
    filename,
  }, true, { timeout: 15000 });
};

/** Upload a local file (e.g. file:// URI from image picker) to S3 via presigned URL. */
export const uploadToPresignedUrl = async (
  localUri: string,
  uploadUrl: string,
  contentType: string
): Promise<void> => {
  let blob: Blob;
  try {
    const response = await fetch(localUri);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(
        `Failed to read local file: ${response.status} ${text || response.statusText}`,
        response.status
      );
    }
    blob = await response.blob();
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Failed to read local file: ${error?.message ?? 'Unknown error'}`,
      0
    );
  }
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResponse.ok) {
    const text = await putResponse.text();
    throw new ApiError(`Upload failed: ${putResponse.status} ${text}`, putResponse.status);
  }
};

// Update user preferences (privacy and notifications)
export interface UserPreferences {
  size_privacy?: 'nobody' | 'friends' | 'everyone';
  recommendations_privacy?: 'nobody' | 'friends' | 'everyone';
  likes_privacy?: 'nobody' | 'friends' | 'everyone';
  order_notifications?: boolean;
  marketing_notifications?: boolean;
}

export const updateUserPreferences = async (
  preferences: UserPreferences
): Promise<UserPreferences> => {
  const response = await apiRequest('/api/v1/user/preferences', 'PUT', preferences, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  });
  
  // Reload full profile to update cache
  const fullProfile = await getCurrentUser();
  await storeUserProfile(fullProfile);
  
  return response;
};

export const updateUserBrands = async (brandIds: string[]): Promise<any> => {
  const response = await apiRequest('/api/v1/user/brands', 'POST', {
    brand_ids: brandIds
  }, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  });
  
  // Refresh user profile to get updated data
  const updatedProfile = await getCurrentUser();
  await storeUserProfile(updatedProfile);
  
  return response;
};

export const updateUserStyles = async (styleIds: string[]): Promise<any> => {
  const response = await apiRequest('/api/v1/user/styles', 'POST', {
    style_ids: styleIds
  }, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  });
  
  // Refresh user profile to get updated data
  const updatedProfile = await getCurrentUser();
  await storeUserProfile(updatedProfile);
  
  return response;
};

// Data caching for brands, styles, and categories to prevent refetching
let brandsCache: Brand[] | null = null;
let stylesCache: Style[] | null = null;
let categoriesCache: any[] | null = null;
let brandsCacheTime: number = 0;
let stylesCacheTime: number = 0;
let categoriesCacheTime: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in-memory
const ASYNC_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24h AsyncStorage

// AsyncStorage keys for persistent cache
const ASYNC_BRANDS_KEY = '@PolkaMobile:brandsCache';
const ASYNC_STYLES_KEY = '@PolkaMobile:stylesCache';
const ASYNC_CATEGORIES_KEY = '@PolkaMobile:categoriesCache';
const ASYNC_POPULAR_KEY = '@PolkaMobile:popularItemsCache';

// Persist to AsyncStorage in background (fire-and-forget)
const persistToStorage = (key: string, data: any) => {
  AsyncStorage.setItem(key, JSON.stringify({ data, time: Date.now() })).catch(() => {});
};

// Load from AsyncStorage (returns null if expired or missing)
const loadFromStorage = async <T>(key: string, maxAge: number): Promise<{ data: T; time: number } | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time > maxAge) return null;
    return parsed;
  } catch {
    return null;
  }
};

// Simple LRU cache with TTL
class LRUCache<T> {
  private cache = new Map<string, { data: T; time: number }>();
  constructor(private maxSize: number, private ttl: number) {}
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.time > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }
  set(key: string, data: T) {
    this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, time: Date.now() });
  }
  delete(key: string) { this.cache.delete(key); }
  clear() { this.cache.clear(); }
}

// Product details: LRU cache (50 products, 10min TTL)
const productDetailsCache = new LRUCache<Product>(50, 10 * 60 * 1000);
export const clearProductDetailsCache = () => productDetailsCache.clear();

// Favorites cache (60s TTL)
let favoritesCache: Product[] | null = null;
let favoritesCacheTime: number = 0;
const FAVORITES_CACHE_DURATION = 60 * 1000;
export const clearFavoritesCache = () => { favoritesCache = null; favoritesCacheTime = 0; };

// Friends cache (2min TTL) — uses `any` since Friend/FriendRequest interfaces declared later
let friendsCache: any[] | null = null;
let friendsCacheTime: number = 0;
let sentRequestsCache: any[] | null = null;
let sentRequestsCacheTime: number = 0;
let receivedRequestsCache: any[] | null = null;
let receivedRequestsCacheTime: number = 0;
const FRIENDS_CACHE_DURATION = 2 * 60 * 1000;
export const clearFriendsCache = () => {
  friendsCache = null; friendsCacheTime = 0;
  sentRequestsCache = null; sentRequestsCacheTime = 0;
  receivedRequestsCache = null; receivedRequestsCacheTime = 0;
};

// Friend recommendations cache (5min TTL, per friend)
const friendRecommendationsCache = new LRUCache<Product[]>(20, 5 * 60 * 1000);
export const clearFriendRecommendationsCache = () => friendRecommendationsCache.clear();

// Search results cache (LRU, 5 min TTL)
const searchResultsCache = new LRUCache<Product[]>(10, 5 * 60 * 1000);
export const clearSearchResultsCache = () => searchResultsCache.clear();

// User stats cache (5min TTL)
let userStatsCache: any | null = null;
let userStatsCacheTime: number = 0;
const USER_STATS_CACHE_DURATION = 5 * 60 * 1000;
export const clearUserStatsCache = () => { userStatsCache = null; userStatsCacheTime = 0; };

// Request deduplication to prevent multiple identical requests
const pendingRequests = new Map<string, Promise<any>>();

// Clear global caches to prevent cross-user contamination
export const clearGlobalCaches = () => {
  console.log('Clearing global caches to prevent cross-user contamination');
  brandsCache = null;
  stylesCache = null;
  categoriesCache = null;
  brandsCacheTime = 0;
  stylesCacheTime = 0;
  categoriesCacheTime = 0;
  clearPopularItemsCache();
  clearProductDetailsCache();
  clearFavoritesCache();
  clearFriendsCache();
  clearFriendRecommendationsCache();
  clearSearchResultsCache();
  clearUserStatsCache();
  pendingRequests.clear();
};

// Brand and Style API functions with caching, deduplication, and AsyncStorage persistence
export const getBrands = async (): Promise<Brand[]> => {
  const now = Date.now();
  if (brandsCache && (now - brandsCacheTime) < CACHE_DURATION) {
    return brandsCache;
  }
  // Try AsyncStorage before hitting API
  if (!brandsCache) {
    const stored = await loadFromStorage<Brand[]>(ASYNC_BRANDS_KEY, ASYNC_CACHE_DURATION);
    if (stored) {
      brandsCache = stored.data;
      brandsCacheTime = stored.time;
      if ((now - stored.time) < CACHE_DURATION) return brandsCache;
      // Stale but usable — refresh in background
    }
  }
  const requestKey = 'getBrands';
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }
  const staleData = brandsCache;
  const brandsPromise = apiRequest('/api/v1/brands', 'GET', undefined, false).then(brands => {
    brandsCache = brands;
    brandsCacheTime = Date.now();
    persistToStorage(ASYNC_BRANDS_KEY, brands);
    pendingRequests.delete(requestKey);
    return brands;
  }).catch(error => {
    pendingRequests.delete(requestKey);
    if (staleData) return staleData; // Return stale on network error
    throw error;
  });
  pendingRequests.set(requestKey, brandsPromise);
  return brandsPromise;
};

export const getStyles = async (): Promise<Style[]> => {
  const now = Date.now();
  if (stylesCache && (now - stylesCacheTime) < CACHE_DURATION) {
    return stylesCache;
  }
  if (!stylesCache) {
    const stored = await loadFromStorage<Style[]>(ASYNC_STYLES_KEY, ASYNC_CACHE_DURATION);
    if (stored) {
      stylesCache = stored.data;
      stylesCacheTime = stored.time;
      if ((now - stored.time) < CACHE_DURATION) return stylesCache;
    }
  }
  const requestKey = 'getStyles';
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }
  const staleData = stylesCache;
  const stylesPromise = apiRequest('/api/v1/styles', 'GET', undefined, false).then(styles => {
    stylesCache = styles;
    stylesCacheTime = Date.now();
    persistToStorage(ASYNC_STYLES_KEY, styles);
    pendingRequests.delete(requestKey);
    return styles;
  }).catch(error => {
    pendingRequests.delete(requestKey);
    if (staleData) return staleData;
    throw error;
  });
  pendingRequests.set(requestKey, stylesPromise);
  return stylesPromise;
};

// Clear cache function for when user logs out
export const clearDataCache = () => {
  brandsCache = null;
  stylesCache = null;
  categoriesCache = null;
  brandsCacheTime = 0;
  stylesCacheTime = 0;
  categoriesCacheTime = 0;
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
  clearFriendsCache();
  return await apiRequest('/api/v1/friends/request', 'POST', {
    recipient_identifier: recipientUsername
  });
};

export const getSentFriendRequests = async (): Promise<FriendRequest[]> => {
  const now = Date.now();
  if (sentRequestsCache && (now - sentRequestsCacheTime) < FRIENDS_CACHE_DURATION) {
    return sentRequestsCache;
  }
  const result = await apiRequest('/api/v1/friends/requests/sent', 'GET');
  sentRequestsCache = result;
  sentRequestsCacheTime = Date.now();
  return result;
};

export const getReceivedFriendRequests = async (): Promise<FriendRequest[]> => {
  const now = Date.now();
  if (receivedRequestsCache && (now - receivedRequestsCacheTime) < FRIENDS_CACHE_DURATION) {
    return receivedRequestsCache;
  }
  const result = await apiRequest('/api/v1/friends/requests/received', 'GET');
  receivedRequestsCache = result;
  receivedRequestsCacheTime = Date.now();
  return result;
};

export const acceptFriendRequest = async (requestId: string): Promise<FriendRequestResponse> => {
  clearFriendsCache();
  return await apiRequest(`/api/v1/friends/requests/${requestId}/accept`, 'POST');
};

export const rejectFriendRequest = async (requestId: string): Promise<FriendRequestResponse> => {
  clearFriendsCache();
  return await apiRequest(`/api/v1/friends/requests/${requestId}/reject`, 'POST');
};

export const cancelFriendRequest = async (requestId: string): Promise<FriendRequestResponse> => {
  clearFriendsCache();
  return await apiRequest(`/api/v1/friends/requests/${requestId}/cancel`, 'DELETE');
};

export const getFriends = async (): Promise<Friend[]> => {
  const now = Date.now();
  if (friendsCache && (now - friendsCacheTime) < FRIENDS_CACHE_DURATION) {
    return friendsCache;
  }
  const result = await apiRequest('/api/v1/friends', 'GET');
  friendsCache = result;
  friendsCacheTime = Date.now();
  return result;
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
  avatar_url?: string | null;
}

// Get public profile of another user
export const getUserPublicProfile = async (userId: string): Promise<PublicUserProfile> => {
  return await apiRequest(`/api/v1/users/${userId}/profile`, 'GET');
};

// Remove a friend
export const removeFriend = async (friendId: string): Promise<FriendRequestResponse> => {
  clearFriendsCache();
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



// Get all categories (cached + AsyncStorage persisted)
export const getCategories = async (): Promise<any[]> => {
  const now = Date.now();
  if (categoriesCache && (now - categoriesCacheTime) < CACHE_DURATION) {
    return categoriesCache;
  }
  if (!categoriesCache) {
    const stored = await loadFromStorage<any[]>(ASYNC_CATEGORIES_KEY, ASYNC_CACHE_DURATION);
    if (stored) {
      categoriesCache = stored.data;
      categoriesCacheTime = stored.time;
      if ((now - stored.time) < CACHE_DURATION) return categoriesCache;
    }
  }
  const requestKey = 'getCategories';
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }
  const staleData = categoriesCache;
  const categoriesPromise = apiRequest('/api/v1/categories', 'GET', undefined, false).then(categories => {
    categoriesCache = categories;
    categoriesCacheTime = Date.now();
    persistToStorage(ASYNC_CATEGORIES_KEY, categories);
    pendingRequests.delete(requestKey);
    return categories;
  }).catch(error => {
    pendingRequests.delete(requestKey);
    if (staleData) return staleData;
    throw error;
  });
  pendingRequests.set(requestKey, categoriesPromise);
  return categoriesPromise;
};

// Payment API functions
export interface Amount {
  value: number;
  currency: string;
}

export interface ReceiptItem {
  product_variant_id: string;
  quantity: number;
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

/** Create order in test mode (no payment gateway). Persists to DB. */
export const createOrderTest = async (
  amount: number,
  items: ReceiptItem[]
): Promise<{ order_id: string }> => {
  return await apiRequest('/api/v1/orders/test', 'POST', {
    amount: { value: amount, currency: 'RUB' },
    description: `Order #${Math.floor(Math.random() * 1000)}`,
    items: items.map((it) => ({
      product_variant_id: it.product_variant_id,
      quantity: it.quantity,
    })),
  });
};

// Order History

// Get user's favorite products (cached, 60s TTL)
export const getUserFavorites = async (forceRefresh = false): Promise<Product[]> => {
  const now = Date.now();
  if (!forceRefresh && favoritesCache && (now - favoritesCacheTime) < FAVORITES_CACHE_DURATION) {
    return favoritesCache;
  }
  const requestKey = 'getUserFavorites';
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }
  const promise = apiRequest('/api/v1/user/favorites', 'GET').then(favorites => {
    favoritesCache = favorites;
    favoritesCacheTime = Date.now();
    pendingRequests.delete(requestKey);
    return favorites;
  }).catch(error => {
    pendingRequests.delete(requestKey);
    throw error;
  });
  pendingRequests.set(requestKey, promise);
  return promise;
};

// Get recommendations for a friend (cached per friend, 5min TTL)
export const getFriendRecommendations = async (friendId: string): Promise<Product[]> => {
  const cached = friendRecommendationsCache.get(friendId);
  if (cached) return cached;
  const result = await apiRequest(`/api/v1/recommendations/for_friend/${friendId}`, 'GET');
  friendRecommendationsCache.set(friendId, result);
  return result;
};

// Get recommendations for the current user
export const getUserRecommendations = async (): Promise<Product[]> => {
  return await apiRequest('/api/v1/recommendations/for_user', 'GET');
};

// Get recent swipes (last 5 seen pieces)
export const getRecentSwipes = async (limit: number = 5): Promise<Product[]> => {
  return await apiRequest(`/api/v1/user/recent-swipes?limit=${limit}`, 'GET');
};

export const toggleFavorite = async (productId: string, action: 'like' | 'unlike'): Promise<{ message: string }> => {
  // Optimistic cache update
  if (favoritesCache) {
    if (action === 'unlike') {
      favoritesCache = favoritesCache.filter(p => String(p.id) !== String(productId));
    }
    // For 'like' we can't add to cache without full product data, so just invalidate
    if (action === 'like') {
      favoritesCacheTime = 0; // Force refresh on next access
    }
  }
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
  // Additional product details for main page compatibility
  brand_name?: string;
  description?: string;
  color?: string;
  materials?: string;
  sku?: string;
  status?: string;  // shipped | returned
  images?: string[];
  return_policy?: string;
  product_id?: string; // Original product ID for swipe tracking
}

/** Order list item (no line items). */
export interface OrderSummary {
  id: string;
  number: string;
  total_amount: number;
  currency: string;
  date: string;
  status: string;
  tracking_number?: string;
  tracking_link?: string;
}

/** Full order with line items (from GET /orders/{id} for brand). */
export interface Order extends OrderSummary {
  /** Order-level shipping (per brand). Item delivery.cost is allocated share; sum equals this. */
  shipping_cost?: number;
  items: OrderItem[];
  delivery_full_name?: string;
  delivery_email?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_postal_code?: string;
}

/** One brand's order within a checkout (Ozon-style). */
export interface OrderPart {
  id: string;
  number: string;
  brand_id: string;
  brand_name?: string;
  brand_is_inactive?: boolean;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  status: string;
  tracking_number?: string;
  tracking_link?: string;
  items: OrderItem[];
}

/** Full checkout with nested orders per brand (Ozon-style, user view). */
export interface CheckoutResponse {
  id: string;
  total_amount: number;
  currency: string;
  date: string;
  orders: OrderPart[];
  delivery_full_name?: string;
  delivery_email?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_postal_code?: string;
}

export type OrderOrCheckout = Order | CheckoutResponse;

export function isCheckoutResponse(r: OrderOrCheckout): r is CheckoutResponse {
  return "orders" in r && Array.isArray((r as CheckoutResponse).orders);
}

/** Order status values (API returns lowercase). See packages/api/models.py OrderStatus. */
export const ORDER_STATUS = {
  PENDING: "pending",
  PAID: "paid",
  SHIPPED: "shipped",
  RETURNED: "returned",
  CANCELED: "canceled",
} as const;

export function getOrderStatusLabel(status: string | undefined): string {
  if (!status) return "неизвестно";
  const s = String(status).toLowerCase();
  switch (s) {
    case "pending":
      return "ожидание";
    case "paid":
      return "оплачен";
    case "shipped":
      return "отправлен";
    case "returned":
      return "возвращён";
    case "partially_returned":
      return "частично\nвозвращён";
    case "canceled":
      return "отменён";
    default:
      return "неизвестно";
  }
}

export const getOrders = async (): Promise<OrderSummary[]> => {
  return await apiRequest('/api/v1/orders', 'GET');
};

/** Fetch full order details by order id. */
export const getOrderById = async (orderId: string): Promise<Order> => {
  return await apiRequest(`/api/v1/orders/${orderId}`, 'GET');
};

export const getProductDetails = async (productId: string): Promise<Product> => {
  const cached = productDetailsCache.get(productId);
  if (cached) return cached;
  const product = await apiRequest(`/api/v1/products/${productId}`, 'GET');
  productDetailsCache.set(productId, product);
  return product;
};

export const getProductSearchResults = async (params: {
  query?: string;
  categories?: string[];
  brands?: string[];
  styles?: string[];
  limit?: number;
  offset?: number;
}): Promise<Product[]> => {
  const searchParams = new URLSearchParams();
  if (params.query) searchParams.append('query', params.query);
  (params.categories || []).forEach((c) => searchParams.append('categories', c));
  (params.brands || []).forEach((b) => searchParams.append('brands', b));
  (params.styles || []).forEach((s) => searchParams.append('styles', s));
  if (params.limit) searchParams.append('limit', params.limit.toString());
  if (params.offset) searchParams.append('offset', params.offset.toString());

  const cacheKey = searchParams.toString();
  const cached = searchResultsCache.get(cacheKey);
  if (cached) return cached;

  const result = await apiRequest(`/api/v1/products/search?${cacheKey}`, 'GET');
  searchResultsCache.set(cacheKey, result);
  return result;
};

// Popular items cache with TTL
let popularItemsCache: Product[] | null = null;
let popularItemsCacheTime: number = 0;
const POPULAR_ITEMS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Clear popular items cache (e.g., on logout)
export const clearPopularItemsCache = () => {
  popularItemsCache = null;
  popularItemsCacheTime = 0;
  console.log('Popular items cache cleared');
};

export const getPopularItems = async (limit: number = 8): Promise<Product[]> => {
  const now = Date.now();
  if (popularItemsCache && (now - popularItemsCacheTime) < POPULAR_ITEMS_CACHE_DURATION) {
    return popularItemsCache;
  }
  // Try AsyncStorage before API
  if (!popularItemsCache) {
    const stored = await loadFromStorage<Product[]>(ASYNC_POPULAR_KEY, ASYNC_CACHE_DURATION);
    if (stored) {
      popularItemsCache = stored.data;
      popularItemsCacheTime = stored.time;
      if ((now - stored.time) < POPULAR_ITEMS_CACHE_DURATION) return popularItemsCache;
    }
  }
  const requestKey = 'getPopularItems';
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!;
  }
  const staleData = popularItemsCache;
  const popularPromise = apiRequest(`/api/v1/products/popular?limit=${limit}`, 'GET', undefined, true).then(items => {
    popularItemsCache = items;
    popularItemsCacheTime = Date.now();
    persistToStorage(ASYNC_POPULAR_KEY, items);
    pendingRequests.delete(requestKey);
    return items;
  }).catch(error => {
    pendingRequests.delete(requestKey);
    if (staleData) return staleData;
    throw error;
  });
  pendingRequests.set(requestKey, popularPromise);
  return popularPromise;
};

// User Statistics
export interface UserStats {
  items_purchased: number;
  items_swiped: number;
  total_orders: number;
  account_age_days: number;
}

export const getUserStats = async (): Promise<UserStats> => {
  const now = Date.now();
  if (userStatsCache && (now - userStatsCacheTime) < USER_STATS_CACHE_DURATION) {
    return userStatsCache;
  }
  const result = await apiRequest('/api/v1/user/stats', 'GET');
  userStatsCache = result;
  userStatsCacheTime = Date.now();
  return result;
};

// Shopping Information
export interface ShoppingInfo {
  full_name: string;
  delivery_email: string;
  phone: string;
  street?: string;
  house_number?: string;
  apartment_number?: string;
  city: string;
  postal_code?: string;
}

// Shopping Information API functions
export const getShoppingInfo = async (): Promise<ShoppingInfo> => {
  const profile = await getCurrentUser();
  const shipping = profile.shipping_info || {};
  return {
    full_name: profile.profile?.full_name || '', // Don't fallback to username
    delivery_email: shipping.delivery_email || profile.email, // Fallback to account email if no delivery email set
    phone: shipping.phone || '',
    street: shipping.street || '',
    house_number: shipping.house_number || '',
    apartment_number: shipping.apartment_number || '',
    city: shipping.city || '',
    postal_code: shipping.postal_code || '',
  };
};

export const updateShoppingInfo = async (shippingInfo: {
  delivery_email: string;
  phone: string;
  street?: string;
  house_number?: string;
  apartment_number?: string;
  city?: string;
  postal_code?: string;
}): Promise<any> => {
  const response = await apiRequest('/api/v1/user/shipping', 'PUT', {
    delivery_email: shippingInfo.delivery_email,
    phone: shippingInfo.phone,
    street: shippingInfo.street,
    house_number: shippingInfo.house_number,
    apartment_number: shippingInfo.apartment_number,
    city: shippingInfo.city,
    postal_code: shippingInfo.postal_code,
  }, true, {
    timeout: API_CONFIG.AUTH_TIMEOUT
  });
  
  // Reload full profile to update cache
  const fullProfile = await getCurrentUser();
  await storeUserProfile(fullProfile);
  
  return response;
};

// Swipe Tracking
export interface SwipeTrackingRequest {
  product_id: string;
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

// Sync local swipe count with API truth
export const syncSwipeCountFromApi = async (apiCount: number): Promise<void> => {
  try {
    await AsyncStorage.setItem(SWIPE_COUNT_KEY, apiCount.toString());
  } catch (error) {
    console.error('Error syncing swipe count:', error);
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
