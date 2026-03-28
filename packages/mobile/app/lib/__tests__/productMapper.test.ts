import { Product } from '../../services/api';
import {
  getCardItemForColorIndex,
  mapProductToCardItem,
  mapProductsToCardItems,
} from '../productMapper';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    name: 'Test Product',
    price: 1000,
    brand_id: 'brand-1',
    brand_name: 'Test Brand',
    category_id: 'cat-1',
    purchase_count: 5,
    general_images: ['https://img.test/gen1.jpg', 'https://img.test/gen2.jpg'],
    color_variants: [
      {
        id: 'cv-1',
        color_name: 'Black',
        color_hex: '#000000',
        images: ['https://img.test/black.jpg'],
        variants: [
          { id: 'v-1', size: 'S', stock_quantity: 3 },
          { id: 'v-2', size: 'M', stock_quantity: 5 },
        ],
      },
      {
        id: 'cv-2',
        color_name: 'White',
        color_hex: '#ffffff',
        images: ['https://img.test/white.jpg'],
        variants: [
          { id: 'v-3', size: 'M', stock_quantity: 2 },
        ],
      },
    ],
    is_liked: false,
    description: 'A test product',
    material: 'Cotton',
    brand_return_policy: '30 days',
    article_number: 'ART-001',
    ...overrides,
  } as Product;
}

describe('mapProductToCardItem', () => {
  it('maps id, name, brand_name, price', () => {
    const card = mapProductToCardItem(makeProduct());
    expect(card.id).toBe('prod-1');
    expect(card.name).toBe('Test Product');
    expect(card.brand_name).toBe('Test Brand');
    expect(card.price).toBe(1000);
  });

  it('selects first color variant by default', () => {
    const card = mapProductToCardItem(makeProduct());
    expect(card.selected_color_index).toBe(0);
    expect(card.color).toBe('Black');
  });

  it('merges color images and general images', () => {
    const card = mapProductToCardItem(makeProduct());
    // color images first, then general
    expect(card.images[0]).toEqual({ uri: 'https://img.test/black.jpg' });
    expect(card.images[1]).toEqual({ uri: 'https://img.test/gen1.jpg' });
    expect(card.images[2]).toEqual({ uri: 'https://img.test/gen2.jpg' });
  });

  it('maps available_sizes from selected variant', () => {
    const card = mapProductToCardItem(makeProduct());
    expect(card.available_sizes).toEqual(['S', 'M']);
  });

  it('maps color_variants array correctly', () => {
    const card = mapProductToCardItem(makeProduct());
    expect(card.color_variants).toHaveLength(2);
    expect(card.color_variants[1].color_name).toBe('White');
  });

  it('sets isLiked from is_liked', () => {
    expect(mapProductToCardItem(makeProduct({ is_liked: true })).isLiked).toBe(true);
    expect(mapProductToCardItem(makeProduct({ is_liked: false })).isLiked).toBe(false);
  });

  it('handles product with no color variants', () => {
    const card = mapProductToCardItem(makeProduct({ color_variants: [] }));
    expect(card.color_variants).toEqual([]);
    expect(card.available_sizes).toEqual([]);
    expect(card.color).toBe('');
  });

  it('handles missing optional fields with defaults', () => {
    const card = mapProductToCardItem(
      makeProduct({ description: undefined, material: undefined, sale_price: undefined })
    );
    expect(card.description).toBe('');
    expect(card.materials).toBe('');
    expect(card.sale_price).toBeNull();
  });

  it('uses fallback id when product.id is missing', () => {
    const card = mapProductToCardItem({ ...makeProduct(), id: undefined } as any, 3);
    expect(card.id).toBe('fallback-3');
  });

  it('falls back to brand_id-based name when brand_name missing', () => {
    const card = mapProductToCardItem(makeProduct({ brand_name: undefined }));
    expect(card.brand_name).toContain('brand-1');
  });
});

describe('getCardItemForColorIndex', () => {
  it('returns correct images for second color', () => {
    const card = mapProductToCardItem(makeProduct());
    const result = getCardItemForColorIndex(card, 1);
    expect(result.color).toBe('White');
    expect(result.images[0]).toEqual({ uri: 'https://img.test/white.jpg' });
  });

  it('includes general images after color images', () => {
    const card = mapProductToCardItem(makeProduct());
    const result = getCardItemForColorIndex(card, 1);
    expect(result.images).toContainEqual({ uri: 'https://img.test/gen1.jpg' });
  });

  it('returns correct available_sizes for color', () => {
    const card = mapProductToCardItem(makeProduct());
    const result = getCardItemForColorIndex(card, 1);
    expect(result.available_sizes).toEqual(['M']);
  });

  it('returns original card data for out-of-range index', () => {
    const card = mapProductToCardItem(makeProduct());
    const result = getCardItemForColorIndex(card, 99);
    expect(result.color).toBe(card.color);
    expect(result.images).toEqual(card.images);
  });
});

describe('mapProductsToCardItems', () => {
  it('maps array of products', () => {
    const products = [makeProduct(), makeProduct({ id: 'prod-2', name: 'Second' })];
    const cards = mapProductsToCardItems(products);
    expect(cards).toHaveLength(2);
    expect(cards[0].id).toBe('prod-1');
    expect(cards[1].id).toBe('prod-2');
  });

  it('returns empty array for empty input', () => {
    expect(mapProductsToCardItems([])).toEqual([]);
  });
});
