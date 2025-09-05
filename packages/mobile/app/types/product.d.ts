import { ImageSourcePropType } from 'react-native';

export interface ProductVariant {
  size: string;
  stock_quantity: number;
}

export interface Product {
  id: string;
  name: string;
  brand_name: string;
  price: string;
  images: ImageSourcePropType[];
  isLiked?: boolean;
  size?: string; // This might be specific to a selected variant, or a default
  quantity?: number; // This might be specific to cart items
  variants?: ProductVariant[];
  description: string;
  color: string;
  materials: string;
  returnPolicy: string;
  brand_return_policy: string;
  available_sizes?: string[]; // Added this
}

export interface DeliveryInfo {
  cost: string;
  estimatedTime: string;
}

export interface CartItem extends Product {
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

// FavoriteItem and RecommendedItem seem to be aliases for Product
export type FavoriteItem = Product;
export type RecommendedItem = Product;
