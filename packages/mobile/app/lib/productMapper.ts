/**
 * Utility functions for mapping API Product objects to CardItem objects.
 * Products have color_variants; CardItem shows one color at a time (selected_color_index).
 * Products are required to have at least one image (general or per color); no default placeholders.
 */

import * as api from '../services/api';
import { CardItem, ColorVariant } from '../types/product';

function mapImages(urls: string[]) {
  if (!urls || urls.length === 0) return [];
  return urls.map((uri) => ({ uri }));
}

/**
 * Maps an API Product to a CardItem. Uses first color variant as selected.
 */
export function mapProductToCardItem(product: api.Product, index?: number): CardItem {
  const color_variants: ColorVariant[] = (product.color_variants || []).map((cv) => ({
    id: cv.id,
    color_name: cv.color_name,
    color_hex: cv.color_hex,
    images: cv.images || [],
    variants: (cv.variants || []).map((v) => ({
      id: v.id,
      size: v.size,
      stock_quantity: v.stock_quantity,
    })),
  }));

  const selected_index = 0;
  const selected = color_variants[selected_index];
  const generalUrls = product.general_images || [];
  const colorUrls = selected?.images || [];
  const combinedUrls = [...generalUrls, ...colorUrls];
  const images = mapImages(combinedUrls.length > 0 ? combinedUrls : (selected?.images || []));
  const variants = selected?.variants ?? [];
  const available_sizes = variants.map((v) => v.size);
  const color = selected?.color_name ?? '';

  return {
    id: product.id ? product.id.toString() : `fallback-${index ?? 0}`,
    name: product.name,
    brand_name: product.brand_name || `Brand ${product.brand_id}`,
    price: product.price,
    images,
    isLiked: product.is_liked === true,
    color_variants,
    selected_color_index: selected_index,
    variants,
    available_sizes,
    description: product.description ?? '',
    color,
    materials: product.material ?? '',
    brand_return_policy: product.brand_return_policy ?? 'No specific brand return policy provided.',
    article_number: product.article_number,
    brand_id: product.brand_id,
    category_id: product.category_id,
    styles: product.styles,
    general_images: product.general_images ?? [],
    sale_price: product.sale_price ?? null,
    sale_type: product.sale_type ?? null,
    sizing_table_image: product.sizing_table_image ?? null,
    delivery_time_min: product.delivery_time_min ?? null,
    delivery_time_max: product.delivery_time_max ?? null,
    country_of_manufacture: product.country_of_manufacture ?? '',
  };
}

/**
 * Returns images and variants for a CardItem for the given color index.
 * Merges general_images (from card) with color-specific images.
 */
export function getCardItemForColorIndex(card: CardItem, colorIndex: number): {
  images: CardItem['images'];
  variants: CardItem['variants'];
  available_sizes: string[];
  color: string;
} {
  const cv = card.color_variants?.[colorIndex];
  const generalUrls = card.general_images ?? [];
  if (!cv) {
    return {
      images: card.images,
      variants: card.variants ?? [],
      available_sizes: card.available_sizes ?? [],
      color: card.color,
    };
  }
  const colorUrls = cv.images ?? [];
  const combined = [...generalUrls, ...colorUrls];
  const images = combined.length > 0 ? combined.map((uri) => ({ uri })) : [];
  const variants = cv.variants ?? [];
  return {
    images,
    variants,
    available_sizes: variants.map((v) => v.size),
    color: cv.color_name,
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
