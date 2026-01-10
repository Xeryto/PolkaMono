import { ImageSourcePropType } from 'react-native';

export interface ProductVariant {
  size: string;
  stock_quantity: number;
}

// Unified CardItem interface used across all screens
export interface CardItem {
  id: string;
  name: string;
  brand_name: string;
  price: number;
  images: ImageSourcePropType[];
  isLiked?: boolean;
  size?: string; // Selected size or default size
  quantity?: number; // For cart items
  variants?: ProductVariant[];
  description: string;
  color: string;
  materials: string;
  brand_return_policy: string; // Brand's return policy (required)
  article_number?: string; // Article number for user-facing identification, search, and sharing
  available_sizes?: string[]; // Available sizes
  // API-specific fields (optional for compatibility)
  brand_id?: number;
  category_id?: string;
  styles?: string[];
}

// Keep Product as alias for backward compatibility
export type Product = CardItem;

export interface DeliveryInfo {
  cost: number;
  estimatedTime: string;
}

export interface CartItem extends CardItem {
  cartItemId?: string; // Unique ID for cart item instance
  delivery: DeliveryInfo;
}

export interface FriendItem {
  id: string;
  username: string;
  email: string;
  status: 'friend' | 'request_sent' | 'request_received' | 'not_friend';
  requestId?: string;
  avatar_url?: string | null; // Modified this
}

export interface FriendRequestItem { // Added this
  requestId: string;
  username: string;
}

// Type aliases for backward compatibility
export type FavoriteItem = CardItem;
export type RecommendedItem = CardItem;
