/**
 * Product color options. Must stay in sync with packages/frontend/src/lib/colors.ts
 * (same name and hex values for consistency across frontend and mobile).
 */
export interface ProductColorOption {
  name: string;
  russian: string;
  hex: string;
}

export const PRODUCT_COLORS: ProductColorOption[] = [
  { name: "Black", russian: "Черный", hex: "#000000" },
  { name: "Blue", russian: "Синий", hex: "#0000FF" },
  { name: "Brown", russian: "Коричневый", hex: "#964B00" },
  { name: "Green", russian: "Зеленый", hex: "#008000" },
  { name: "Grey", russian: "Серый", hex: "#808080" },
  { name: "Multi-Color", russian: "Многоцветный", hex: "linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)" },
  { name: "Orange", russian: "Оранжевый", hex: "#FFA500" },
  { name: "Pink", russian: "Розовый", hex: "#FFC0CB" },
  { name: "Purple", russian: "Фиолетовый", hex: "#800080" },
  { name: "Red", russian: "Красный", hex: "#FF0000" },
  { name: "White", russian: "Белый", hex: "#FFFFFF" },
  { name: "Yellow", russian: "Желтый", hex: "#FFFF00" },
];

export function getColorHex(name: string): string {
  const c = PRODUCT_COLORS.find((x) => x.name === name);
  return c?.hex ?? "#808080";
}
