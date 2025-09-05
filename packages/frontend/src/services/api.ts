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

// API configuration
const API_URL = "http://localhost:8000"; // Assuming API is running on this URL

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
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: UserProfileResponse;
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
  shipping_price?: string;
  shipping_provider?: string;
  created_at: string;
  updated_at: string;
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
  shipping_price?: string;
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
  price: string;
  images: string[];
  honest_sign?: string;
  color?: string;
  material?: string;
  hashtags?: string[];
  brand_id: number;
  category_id: string;
  styles: string[];
  variants: ProductVariantSchema[];
  return_policy?: string; // NEW
  sku?: string; // NEW
  is_liked?: boolean; // Only for user-specific recommendations/favorites
}

export interface OrderItemResponse {
  id: string;
  name: string;
  price: string;
  size: string;
  image?: string;
  honest_sign?: string;
  delivery: {
    cost: string;
    estimatedTime: string;
    tracking_number?: string;
  };
}

export interface OrderResponse {
  id: string;
  number: string;
  total: string;
  date: string;
  status: string;
  tracking_number?: string;
  tracking_link?: string; // NEW
  items: OrderItemResponse[];
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

// API request helper with automatic token refresh (simplified for frontend)
const apiRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  requireAuth: boolean = true
) => {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('authToken');
    if (requireAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Basic 401 handling (can be expanded)
    if (response.status === 401) {
      console.error('API Request: Authentication required.');
      // In a real app, you'd redirect to login or refresh token
      throw new ApiError('Authentication required', 401);
    }

    return await handleApiResponse(response);
  } catch (error) {
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
  price: string;
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
}): Promise<ProductResponse> => {
  return await apiRequest('/api/v1/brands/products', 'POST', productData);
};

export const updateProduct = async (productId: string, productData: {
  name?: string;
  description?: string;
  price?: string;
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
}): Promise<ProductResponse> => {
  return await apiRequest(`/api/v1/brands/products/${productId}`, 'PUT', productData);
};

export const getBrandProducts = async (): Promise<ProductResponse[]> => {
  return await apiRequest('/api/v1/brands/products', 'GET');
};

export const getStyles = async (): Promise<any[]> => {
  return await apiRequest('/api/v1/styles', 'GET');
};

// Order related
export const updateOrderItemHonestSign = async (orderItemId: string, honestSign: string): Promise<any> => {
  return await apiRequest(`/api/v1/brands/order-items/${orderItemId}/honest-sign`, 'PUT', { honest_sign: honestSign });
};

export const updateOrderTracking = async (orderId: string, trackingData: { tracking_number?: string; tracking_link?: string }): Promise<any> => {
  return await apiRequest(`/api/v1/brands/orders/${orderId}/tracking`, 'PUT', trackingData);
};

export const getOrders = async (): Promise<OrderResponse[]> => {
  return await apiRequest('/api/v1/orders', 'GET');
};

// --- Brand Authentication & Profile ---
export const brandLogin = async (credentials: BrandLoginRequest): Promise<AuthResponse> => {
  const response = await apiRequest('/api/v1/brands/auth/login', 'POST', credentials, false); // No auth required for login
  localStorage.setItem('authToken', response.token); // Store token
  return response;
};

export const getBrandProfile = async (): Promise<BrandResponse> => {
  return await apiRequest('/api/v1/brands/profile', 'GET');
};

export const updateBrandProfile = async (profileData: BrandProfileUpdateRequest): Promise<BrandResponse> => {
  return await apiRequest('/api/v1/brands/profile', 'PUT', profileData);
};

// --- User Profile (Mobile App User) ---
export const getUserProfile = async (): Promise<UserProfileResponse> => {
  return await apiRequest('/api/v1/user/profile', 'GET');
};

export const updateUserProfile = async (profileData: UserProfileResponse): Promise<UserProfileResponse> => {
  return await apiRequest('/api/v1/user/profile', 'PUT', profileData);
};

// --- Product Liking ---
export const toggleFavorite = async (toggleData: ToggleFavoriteRequest): Promise<{ message: string }> => {
  return await apiRequest('/api/v1/user/favorites/toggle', 'POST', toggleData);
};

export const getUserFavorites = async (): Promise<ProductResponse[]> => {
  return await apiRequest('/api/v1/user/favorites', 'GET');
};

// --- Product Recommendations ---
export const getUserRecommendations = async (limit: number = 5): Promise<ProductResponse[]> => {
  return await apiRequest(`/api/v1/recommendations/for_user?limit=${limit}`, 'GET');
};