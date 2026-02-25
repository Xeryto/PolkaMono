import {
  fetchWithTimeoutAndRetry, 
  getNetworkErrorMessage, 
  isRetryableError,
  RequestOptions 
} from './networkUtils';
import { ENV_CONFIG, log } from '@/config/environment';

// API configuration
const API_URL = ENV_CONFIG.API_BASE_URL;

// Error handling
class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// --- Interfaces ---

export interface UserProfileResponse {
  id: string;
  username: string;
  email: string;
  gender?: string;
  selected_size?: string;
  avatar_url?: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_brand: boolean;
  // Shopping information fields
  full_name?: string;
  delivery_email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: UserProfileResponse;
}

// Shopping Information
export interface ShoppingInfo {
  full_name: string;
  delivery_email: string;
  phone: string;
  address: string;
  city: string;
  postal_code?: string;
}

export interface BrandResponse {
  id: number;
  name: string;
  email: string;
  slug: string;
  logo?: string;
  description?: string;
  return_policy?: string;
  min_free_shipping?: number;
  shipping_price?: number;
  shipping_provider?: string;
  amount_withdrawn: number;
  inn?: string;
  registration_address?: string;
  payout_account?: string;
  payout_account_locked: boolean;
  delivery_time_min?: number;
  delivery_time_max?: number;
  is_inactive: boolean;
  two_factor_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandStatsResponse {
  total_sold: number;
  total_withdrawn: number;
  current_balance: number;
}

export interface BrandLoginRequest {
  email: string;
  password: string;
}

export interface BrandProfileUpdateRequest {
  name?: string;
  email?: string;
  password?: string;
  slug?: string;
  logo?: string;
  description?: string;
  return_policy?: string;
  min_free_shipping?: number;
  shipping_price?: number;
  shipping_provider?: string;
  inn?: string;
  registration_address?: string;
  payout_account?: string;
  payout_account_locked?: boolean;
  delivery_time_min?: number;
  delivery_time_max?: number;
}

export interface ProductVariantSchema {
  id?: string;
  size: string;
  stock_quantity: number;
}

export interface ProductColorVariantSchema {
  id?: string;
  color_name: string;
  color_hex: string;
  images: string[];
  variants: ProductVariantSchema[];
}

export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  material?: string;
  brand_id: number;
  category_id: string;
  styles: string[];
  color_variants: ProductColorVariantSchema[];
  article_number?: string;
  is_liked?: boolean;
  general_images?: string[];
  delivery_time_min?: number;
  delivery_time_max?: number;
  sale_price?: number | null;
  sale_type?: 'percent' | 'exact' | null;
  sizing_table_image?: string | null;
}

export interface ProductColorVariantCreate {
  color_name: string;
  color_hex: string;
  images: string[];
  variants: ProductVariantSchema[];
}

export interface OrderSummary {
  id: string;
  number: string;
  total_amount: number;
  currency?: string;
  date: string;
  status: string;
  tracking_number?: string;
  tracking_link?: string;
  shipping_cost?: number;
}

export interface OrderItemResponse {
  id: string;
  name: string;
  price: number;
  size: string;
  image?: string;
  sku?: string;  // Stock Keeping Unit - renamed from honest_sign
  delivery: {
    cost: number;
    estimatedTime: string;
    tracking_number?: string;
  };
}

export interface OrderResponse {
  id: string;
  number: string;
  total_amount: number;
  date: string;
  status: string;
  tracking_number?: string;
  tracking_link?: string;
  /** Order-level shipping (per brand). Do not sum item delivery.cost for totals. */
  shipping_cost?: number;
  items: OrderItemResponse[];
  delivery_full_name?: string;
  delivery_email?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_postal_code?: string;
}

/** One brand's order within a checkout (Ozon-style). */
export interface OrderPartResponse {
  id: string;
  number: string;
  brand_id: number;
  brand_name?: string;
  subtotal: number;
  shipping_cost: number;
  total_amount: number;
  status: string;
  tracking_number?: string;
  tracking_link?: string;
  items: OrderItemResponse[];
}

/** Full checkout with nested orders per brand (Ozon-style). */
export interface CheckoutResponse {
  id: string;
  total_amount: number;
  currency: string;
  date: string;
  orders: OrderPartResponse[];
  delivery_full_name?: string;
  delivery_email?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_postal_code?: string;
}

export type OrderOrCheckoutResponse = OrderResponse | CheckoutResponse;

export function isCheckoutResponse(r: OrderOrCheckoutResponse): r is CheckoutResponse {
  return 'orders' in r && Array.isArray((r as CheckoutResponse).orders);
}

export interface StyleResponse {
  id: string;
  name: string;
  description?: string;
  image?: string;
}

export interface ToggleFavoriteRequest {
  product_id: string;
  action: 'like' | 'unlike';
}

export interface UserRecommendationsResponse extends Array<ProductResponse> {}

/**
 * FastAPI 422 responses have detail as either a string or an array of
 * { loc: string[], msg: string, type: string }. Convert to a flat map of
 * fieldName -> errorMessage for easy display.
 */
export function parsePydanticErrors(detail: unknown): Record<string, string> {
  if (!Array.isArray(detail)) return {};
  const map: Record<string, string> = {};
  for (const err of detail) {
    if (err && typeof err === 'object' && Array.isArray(err.loc)) {
      const field = String(err.loc[err.loc.length - 1] ?? 'general');
      map[field] = String(err.msg ?? 'Invalid value');
    }
  }
  return map;
}

// Helper to handle API responses
const handleApiResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    const fieldErrors = response.status === 422 ? parsePydanticErrors(data.detail) : undefined;
    const err = new ApiError(
      Array.isArray(data.detail)
        ? (data.detail[0]?.msg ?? 'Validation error')
        : (data.detail || data.message || 'An error occurred'),
      response.status
    );
    err.fieldErrors = fieldErrors;
    throw err;
  }

  return data;
};

// API request helper with automatic token refresh, timeout, and retry logic
const apiRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  requireAuth: boolean = true,
  token: string | null = null, // Add token parameter
  requestOptions: RequestOptions = {}
) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && token) { // Use passed token
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
        // Use configured timeout
        timeout: requestOptions.timeout ?? ENV_CONFIG.API_TIMEOUT,
      }
    );

    // Handle 401 responses properly - let handleApiResponse process the error
    // Only dispatch auth-error event for authenticated requests, not login attempts
    if (response.status === 401 && requireAuth) {
      console.error('API Request: Authentication required.');
      window.dispatchEvent(new Event('auth-error'));
    }

    return await handleApiResponse(response);
  } catch (error) {
    // Handle network errors with user-friendly messages
    if (isRetryableError(error as Error)) {
      const friendlyMessage = getNetworkErrorMessage(error as Error);
      throw new ApiError(friendlyMessage, 0); // Use 0 status for network errors
    }
    
    if (error instanceof ApiError) {
      console.error('API Error:', error.message, error.status);
    } else {
      console.error('Network or unexpected error:', error);
    }
    throw error;
  }
};

// --- API Functions ---

// Exclusive access signup (landing page, no auth)
export const exclusiveAccessSignup = async (email: string): Promise<{ message: string }> => {
  return await apiRequest('/api/v1/exclusive-access-signup', 'POST', { email }, false);
};

// Product related
export const createProduct = async (productData: {
  name: string;
  description?: string;
  price: number;
  brand_id: number;
  category_id: string;
  styles: string[];
  color_variants: ProductColorVariantCreate[];
  material?: string;
  article_number?: string;
  general_images?: string[];
}, token: string, requestOptions?: RequestOptions): Promise<ProductResponse> => {
  return await apiRequest('/api/v1/brands/products', 'POST', productData, true, token, requestOptions);
};

export const updateProduct = async (productId: string, productData: {
  name?: string;
  description?: string;
  price?: number;
  brand_id?: number;
  category_id?: string;
  styles?: string[];
  color_variants?: ProductColorVariantCreate[];
  material?: string;
  general_images?: string[];
  sale_price?: number | null;
  sale_type?: 'percent' | 'exact' | null;
  sizing_table_image?: string | null;
  delivery_time_min?: number | null;
  delivery_time_max?: number | null;
}, token: string): Promise<ProductResponse> => {
  return await apiRequest(`/api/v1/brands/products/${productId}`, 'PUT', productData, true, token);
};

export const getBrandProducts = async (token: string, requestOptions?: RequestOptions): Promise<ProductResponse[]> => { // Add token parameter
  return await apiRequest('/api/v1/brands/products', 'GET', undefined, true, token, requestOptions);
};

export const getStyles = async (): Promise<any[]> => {
  return await apiRequest('/api/v1/styles', 'GET', undefined, false); // Styles might not require auth
};

export const getCategories = async (): Promise<any[]> => {
  return await apiRequest('/api/v1/categories', 'GET', undefined, false); // Categories might not require auth
};

export const uploadProductImages = async (productId: string, formData: FormData, token: string): Promise<any> => {
  const response = await fetch(`${API_URL}/api/v1/brands/products/${productId}/images`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  return await handleApiResponse(response);
};

/** S3 presigned upload: get URL from API then PUT file to S3. Use public_url in product or profile. */
export interface PresignedUploadResponse {
  upload_url: string;
  public_url: string;
  key: string;
}

export const getProductImagePresignedUrl = async (
  contentType: string,
  token: string,
  filename?: string
): Promise<PresignedUploadResponse> => {
  return await apiRequest('/api/v1/brands/upload/presigned-url', 'POST', { content_type: contentType, filename }, true, token);
};

export const getAvatarPresignedUrl = async (
  contentType: string,
  token: string,
  filename?: string
): Promise<PresignedUploadResponse> => {
  return await apiRequest('/api/v1/user/upload/presigned-url', 'POST', { content_type: contentType, filename }, true, token);
};

/** Upload a file to S3 using a presigned PUT URL. */
export const uploadFileToPresignedUrl = async (
  file: File,
  uploadUrl: string,
  contentType: string
): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
  } catch (err: any) {
    // Network error or CORS block (browser often reports as "failed to fetch")
    const msg = err?.message || '';
    const hint = msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('cors')
      ? ' Add your frontend origin (e.g. http://localhost:5173) to the S3 bucket CORS AllowedOrigins.'
      : '';
    throw new ApiError(`Image upload failed: ${msg}${hint}`, 0);
  }
  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(`Upload failed: ${response.status} ${text}`, response.status);
  }
};

// Order related
export const updateOrderItemSKU = async (orderItemId: string, sku: string, token: string): Promise<any> => { // Add token parameter
  return await apiRequest(`/api/v1/brands/order-items/${orderItemId}/sku`, 'PUT', { sku: sku }, true, token);
};

export const updateOrderTracking = async (orderId: string, trackingData: { tracking_number?: string; tracking_link?: string }, token: string): Promise<any> => {
  return await apiRequest(`/api/v1/brands/orders/${orderId}/tracking`, 'PUT', trackingData, true, token);
};

/** Mark a SHIPPED order as RETURNED (brand received the returned item). Restores stock. */
export const markOrderReturned = async (orderId: string, token: string): Promise<any> => {
  return await apiRequest(`/api/v1/brands/orders/${orderId}/return`, 'PUT', undefined, true, token);
};

export const getOrders = async (token: string): Promise<OrderSummary[]> => {
  return await apiRequest('/api/v1/orders', 'GET', undefined, true, token);
};

/** Fetch full order details for a brand (items, delivery). Use after brand taps an order in the dashboard list. */
export const getOrder = async (orderId: string, token: string): Promise<OrderResponse> => {
  return await apiRequest(`/api/v1/orders/${orderId}`, 'GET', undefined, true, token);
};

/** Fetch full checkout details for the current user (nested orders per brand). Use when user taps an order in "my orders". */
export const getCheckout = async (checkoutId: string, token: string): Promise<CheckoutResponse> => {
  return await apiRequest(`/api/v1/checkouts/${checkoutId}`, 'GET', undefined, true, token);
};

// --- Brand Authentication & Profile ---
export const brandLogin = async (credentials: BrandLoginRequest): Promise<AuthResponse> => {
  const response = await apiRequest('/api/v1/brands/auth/login', 'POST', credentials, false); // No auth required for login
  // localStorage.setItem('authToken', response.token); // AuthContext will handle storing token
  return response;
};

export const getBrandProfile = async (token: string): Promise<BrandResponse> => { // Add token parameter
  return await apiRequest('/api/v1/brands/profile', 'GET', undefined, true, token);
};

export const getBrandStats = async (token: string): Promise<BrandStatsResponse> => {
  return await apiRequest('/api/v1/brands/stats', 'GET', undefined, true, token);
};

export const updateBrandProfile = async (profileData: BrandProfileUpdateRequest, token: string): Promise<BrandResponse> => { // Add token parameter
  return await apiRequest('/api/v1/brands/profile', 'PUT', profileData, true, token);
};

// --- Brand Password Reset ---
export const brandRequestPasswordReset = async (identifier: string): Promise<void> => {
  await apiRequest('/api/v1/brands/auth/forgot-password', 'POST', { identifier }, false);
};

export const brandValidatePasswordResetCode = async (identifier: string, code: string): Promise<void> => {
  await apiRequest('/api/v1/brands/auth/validate-password-reset-code', 'POST', { identifier, code }, false);
};

export const brandResetPasswordWithCode = async (identifier: string, code: string, password: string): Promise<void> => {
  await apiRequest('/api/v1/brands/auth/reset-password-with-code', 'POST', { identifier, code, new_password: password }, false);
};

// --- User Profile (Mobile App User) ---
export const getUserProfile = async (token: string): Promise<UserProfileResponse> => { // Add token parameter
  return await apiRequest('/api/v1/user/profile', 'GET', undefined, true, token);
};

export const updateUserProfile = async (profileData: UserProfileResponse, token: string): Promise<UserProfileResponse> => { // Add token parameter
  return await apiRequest('/api/v1/user/profile', 'PUT', profileData, true, token);
};

// Shopping Information API functions
export const getShoppingInfo = async (token: string): Promise<ShoppingInfo> => {
  // For brands, shopping info is not applicable, return empty values
  // Brands don't have delivery information as they are the sellers, not buyers
  return {
    full_name: '',
    delivery_email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
  };
};

export const updateShoppingInfo = async (shoppingInfo: ShoppingInfo, token: string): Promise<ShoppingInfo> => {
  // For brands, shopping info updates are not applicable
  // Brands don't have delivery information as they are the sellers, not buyers
  console.log('updateShoppingInfo called for brand - no action needed');
  return shoppingInfo;
};

// --- Product Liking ---
export const toggleFavorite = async (toggleData: ToggleFavoriteRequest, token: string): Promise<{ message: string }> => { // Add token parameter
  return await apiRequest('/api/v1/user/favorites/toggle', 'POST', toggleData, true, token);
};

export const getUserFavorites = async (token: string): Promise<ProductResponse[]> => { // Add token parameter
  return await apiRequest('/api/v1/user/favorites', 'GET', undefined, true, token);
};

// --- Product Recommendations ---
export const getUserRecommendations = async (limit: number = 5, token: string): Promise<ProductResponse[]> => { // Add token parameter
  return await apiRequest(`/api/v1/recommendations/for_user?limit=${limit}`, 'GET', undefined, true, token);
};

// -- Phase 7: Account Management + 2FA --

export interface BrandDeleteResponse {
  message: string;
  scheduled_deletion_at: string;
}

export interface OTPLoginResponse {
  otp_required: true;
  session_token: string;
}

export interface OTPVerifyResponse {
  token: string;
  expires_at: string;
  user: UserProfileResponse;
}

export const toggleBrandInactive = async (is_inactive: boolean, token: string): Promise<{ is_inactive: boolean }> => {
  return apiRequest('/api/v1/brands/me/inactive', 'PATCH', { is_inactive }, true, token);
};

export const requestBrandDeletion = async (token: string): Promise<BrandDeleteResponse> => {
  return apiRequest('/api/v1/brands/me', 'DELETE', undefined, true, token);
};

export const changeBrandPassword = async (
  current_password: string,
  new_password: string,
  token: string
): Promise<{ message: string }> => {
  return apiRequest('/api/v1/brands/auth/change-password', 'POST', { current_password, new_password }, true, token);
};

export const enableBrand2FA = async (token: string): Promise<{ message: string; pending_confirmation: boolean }> => {
  return apiRequest('/api/v1/brands/auth/2fa/enable', 'POST', {}, true, token);
};

export const confirmBrand2FA = async (code: string, token: string): Promise<{ message: string; two_factor_enabled: boolean }> => {
  return apiRequest('/api/v1/brands/auth/2fa/confirm', 'POST', { code }, true, token);
};

export const disableBrand2FA = async (password: string, token: string): Promise<{ message: string; two_factor_enabled: boolean }> => {
  return apiRequest('/api/v1/brands/auth/2fa/disable', 'POST', { password }, true, token);
};

export const verify2FA = async (session_token: string, code: string): Promise<OTPVerifyResponse> => {
  return apiRequest('/api/v1/brands/auth/2fa/verify', 'POST', { session_token, code }, false);
};

export const resend2FA = async (session_token: string): Promise<{ message: string; resends_remaining: number }> => {
  return apiRequest('/api/v1/brands/auth/2fa/resend', 'POST', { session_token }, false);
};

// -- Phase 8: Notifications --

export interface NotificationItem {
  id: string;
  type: string;
  message: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string; // ISO datetime string
}

export interface NotificationsResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

export async function fetchNotifications(token: string): Promise<NotificationsResponse> {
  return apiRequest('/api/v1/notifications/', 'GET', undefined, true, token);
}

export async function markNotificationsRead(token: string): Promise<void> {
  await apiRequest('/api/v1/notifications/read', 'POST', {}, true, token);
}

export async function sendAdminNotification(message: string): Promise<void> {
  const token = localStorage.getItem('authToken');
  const res = await fetch(`${API_URL}/api/v1/admin/notifications/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  });
  if (!res.ok && res.status !== 204) throw new Error('Failed to send notification');
}