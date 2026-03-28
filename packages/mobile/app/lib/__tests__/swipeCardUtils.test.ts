import { LOADING_CARD_ID } from '../swipeCardConstants';
import {
  createLoadingCard,
  formatDeliveryTime,
  formatPrice,
  getEffectivePrice,
} from '../swipeCardUtils';

describe('getEffectivePrice', () => {
  it('returns original price when no sale', () => {
    expect(getEffectivePrice({ price: 1000 })).toBe(1000);
  });

  it('returns original price when sale_price is null', () => {
    expect(getEffectivePrice({ price: 1000, sale_price: null })).toBe(1000);
  });

  it('returns original price when sale_price is 0', () => {
    expect(getEffectivePrice({ price: 1000, sale_price: 0 })).toBe(1000);
  });

  it('calculates percent discount correctly', () => {
    expect(getEffectivePrice({ price: 1000, sale_price: 20, sale_type: 'percent' })).toBe(800);
  });

  it('returns exact sale price for type "exact"', () => {
    expect(getEffectivePrice({ price: 1000, sale_price: 750, sale_type: 'exact' })).toBe(750);
  });

  it('returns exact price when sale_type is null but sale_price set', () => {
    expect(getEffectivePrice({ price: 1000, sale_price: 750, sale_type: null })).toBe(750);
  });
});

describe('formatDeliveryTime', () => {
  it('returns null when both min and max are null', () => {
    expect(formatDeliveryTime(null, null)).toBeNull();
  });

  it('returns null when both are undefined', () => {
    expect(formatDeliveryTime(undefined, undefined)).toBeNull();
  });

  it('formats range when both min and max provided', () => {
    expect(formatDeliveryTime(3, 7)).toBe('3–7 дней');
  });

  it('formats min-only', () => {
    expect(formatDeliveryTime(3, null)).toBe('от 3 дней');
  });

  it('formats max-only', () => {
    expect(formatDeliveryTime(null, 7)).toBe('до 7 дней');
  });

  it('formats single-day range', () => {
    expect(formatDeliveryTime(1, 1)).toBe('1–1 дней');
  });
});

describe('formatPrice', () => {
  it('formats integer price with comma decimal', () => {
    expect(formatPrice(1000)).toBe('1000,00');
  });

  it('formats fractional price', () => {
    expect(formatPrice(999.9)).toBe('999,90');
  });

  it('formats zero', () => {
    expect(formatPrice(0)).toBe('0,00');
  });
});

describe('createLoadingCard', () => {
  it('returns a card with LOADING_CARD_ID', () => {
    const card = createLoadingCard();
    expect(card.id).toBe(LOADING_CARD_ID);
  });

  it('has loading placeholder text', () => {
    const card = createLoadingCard();
    expect(card.name).toBe('загрузка...');
    expect(card.brand_name).toBe('загрузка...');
  });

  it('has zero price', () => {
    expect(createLoadingCard().price).toBe(0);
  });

  it('has isLiked false', () => {
    expect(createLoadingCard().isLiked).toBe(false);
  });

  it('has empty color_variants', () => {
    expect(createLoadingCard().color_variants).toEqual([]);
  });
});
