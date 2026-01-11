/**
 * Utility functions for mapping API Product objects to CardItem objects
 * Ensures consistent data transformation across all screens (Main, Search, Favorites, Cart, Settings, etc.)
 */

import { ImageSourcePropType } from 'react-native';
import * as api from '../services/api';
import { CardItem } from '../types/product';

// Fallback images for products without images
const fallbackImage = require('../assets/Vision.png');
const vision2Image = require('../assets/Vision2.png');

/**
 * Maps an API Product object to a CardItem object
 * This function ensures article_number and all other fields are consistently preserved
 * across all screens in the mobile app
 * 
 * @param product - The API Product object to map
 * @param index - Optional index for fallback ID generation
 * @returns A CardItem object with all fields properly mapped
 */
export function mapProductToCardItem(
  product: api.Product,
  index?: number
): CardItem {
  return {
    id: product.id ? product.id.toString() : `fallback-${index ?? 0}`,
    name: product.name,
    brand_name: product.brand_name || `Brand ${product.brand_id}`,
    price: product.price,
    images:
      product.images && product.images.length > 0
        ? product.images.map((img) => ({ uri: img }))
        : [fallbackImage, vision2Image],
    isLiked: product.is_liked === true,
    variants: product.variants || [],
    description:
      product.description || '',
    color: product.color || '',
    materials: product.material || '',
    brand_return_policy:
      product.brand_return_policy || product.return_policy || 'No specific brand return policy provided.',
    article_number: product.article_number, // Preserve article_number for all screens
    available_sizes: product.variants
      ? product.variants.map((v) => v.size)
      : [],
    // Optional API-specific fields for compatibility
    brand_id: product.brand_id,
    category_id: product.category_id,
    styles: product.styles,
  };
}

/**
 * Maps an array of API Product objects to CardItem objects
 * @param products - Array of API Product objects
 * @returns Array of CardItem objects
 */
export function mapProductsToCardItems(products: api.Product[]): CardItem[] {
  return products.map((product, index) => mapProductToCardItem(product, index));
}
