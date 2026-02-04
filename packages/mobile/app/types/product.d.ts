import { ImageSourcePropType } from 'react-native';

/** Size/stock for one color variant */
export interface ProductVariant {
  id?: string; // ProductVariant.id from API (for cart/order)
  size: string;
  stock_quantity: number;
}

/** One color variation: its own images and size variants */
export interface ColorVariant {
  id?: string;
  color_name: string;
  color_hex: string;
  images: string[];
  variants: ProductVariant[];
}

// Unified CardItem interface used across all screens (product with selected color)
export interface CardItem {
  id: string;
  name: string;
  brand_name: string;
  price: number;
  /** Images for the currently selected color (derived from color_variants[selected_color_index]) */
  images: ImageSourcePropType[];
  isLiked?: boolean;
  size?: string;
  quantity?: number;
  /** All color variations (each with images and size/stock) */
  color_variants: ColorVariant[];
  /** Index into color_variants for the currently displayed color */
  selected_color_index: number;
  /** Size variants for the currently selected color (derived) */
  variants?: ProductVariant[];
  description: string;
  /** Display color name for selected color */
  color: string;
  materials: string;
  brand_return_policy: string;
  article_number?: string;
  available_sizes?: string[];
  brand_id?: number;
  category_id?: string;
  styles?: string[];
  /** Product-level images shown for all colors (merged with color images) */
  general_images?: string[];
}

// Keep Product as alias for backward compatibility
export type Product = CardItem;

export interface DeliveryInfo {
  cost: number;
  estimatedTime: string;
}

export interface CartItem extends CardItem {
  cartItemId?: string;
  delivery: DeliveryInfo;
  /** API ProductVariant.id for checkout (required for payment) */
  product_variant_id?: string;
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
