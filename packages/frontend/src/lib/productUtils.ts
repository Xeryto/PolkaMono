import type { ProductResponse } from "@/services/api";

export function getTotalStock(product: ProductResponse): number {
  return (
    product.color_variants?.reduce(
      (sum, cv) =>
        sum + (cv.variants?.reduce((s, v) => s + v.stock_quantity, 0) ?? 0),
      0,
    ) ?? 0
  );
}

export function hasLowStock(product: ProductResponse, threshold = 3): boolean {
  return (
    product.color_variants?.some((cv) =>
      cv.variants?.some(
        (v) => v.stock_quantity > 0 && v.stock_quantity < threshold,
      ),
    ) ?? false
  );
}
