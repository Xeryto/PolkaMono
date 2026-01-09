import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PlusCircle, XCircle } from "lucide-react";
import * as api from "@/services/api"; // Assuming API calls are here
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
}

export interface ProductVariantSchema {
  size: string;
  stock_quantity: number;
}

export interface ProductResponse {
  id: string;
  name: string;
  description?: string;
  price: number;
  images: string[];
  color?: string;
  material?: string;
  brand_id: number;
  category_id: string;
  styles: string[];
  variants: ProductVariantSchema[];
  sku?: string; // NEW
  is_liked?: boolean; // Only for user-specific recommendations/favorites
}

export interface OrderItemResponse {
  id: string;
  name: string;
  price: number;
  size: string;
  image?: string;
  honest_sign?: string;
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
  tracking_link?: string; // NEW
  items: OrderItemResponse[];
  // Delivery information stored at order creation time
  delivery_full_name?: string;
  delivery_email?: string;
  delivery_phone?: string;
  delivery_address?: string;
  delivery_city?: string;
  delivery_postal_code?: string;
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

// Helper to handle API responses
const handleApiResponse = async (response: Response) => {
  const data = await response.json();
  
  if (!response.ok) {
    throw new ApiError(
      data.detail || data.message || 'An error occurred',
      response.status
    );
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

// Product related
export const createProduct = async (productData: {
  name: string;
  description?: string;
  price: number;
  images: string[];
  honest_sign?: string;
  color?: string;
  material?: string;
  hashtags?: string[];
  brand_id: number;
  category_id: string;
  styles: string[];
  variants: ProductVariantSchema[];
  return_policy?: string;
  sku?: string;
}, token: string, requestOptions?: RequestOptions): Promise<ProductResponse> => { // Add token parameter
  return await apiRequest('/api/v1/brands/products', 'POST', productData, true, token, requestOptions);
};

export const updateProduct = async (productId: string, productData: {
  name?: string;
  description?: string;
  price?: number;
  images?: string[];
  honest_sign?: string;
  color?: string;
  material?: string;
  hashtags?: string[];
  brand_id?: number;
  category_id?: string;
  styles?: string[];
  variants?: ProductVariantSchema[];
  return_policy?: string;
  sku?: string;
}, token: string): Promise<ProductResponse> => { // Add token parameter
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

// Order related
export const updateOrderItemHonestSign = async (orderItemId: string, honestSign: string, token: string): Promise<any> => { // Add token parameter
  return await apiRequest(`/api/v1/brands/order-items/${orderItemId}/honest-sign`, 'PUT', { honest_sign: honestSign }, true, token);
};

export const updateOrderTracking = async (orderId: string, trackingData: { tracking_number?: string; tracking_link?: string }, token: string): Promise<any> => { // Add token parameter
  return await apiRequest(`/api/v1/brands/orders/${orderId}/tracking`, 'PUT', trackingData, true, token);
};

export const getOrders = async (token: string): Promise<OrderResponse[]> => { // Add token parameter
  return await apiRequest('/api/v1/orders', 'GET', undefined, true, token);
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