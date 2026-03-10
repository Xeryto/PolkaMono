export const sizes = [
  { name: "XS", russian: "XS" },
  { name: "S", russian: "S" },
  { name: "M", russian: "M" },
  { name: "L", russian: "L" },
  { name: "XL", russian: "XL" },
  { name: "One Size", russian: "One Size" },
];

export type SizeType = "standard" | "waist_length" | "numeric_eu";

/** Categories that allow the brand to choose between sizing modes. */
export const categorySizeTypes: Record<string, SizeType[]> = {
  tshirts: ["standard"],
  hoodies: ["standard"],
  dresses: ["standard"],
  jeans: ["standard", "waist_length"],
  sneakers: ["numeric_eu"],
};

export const waistValues = Array.from({ length: 27 }, (_, i) => 58 + i * 2); // 58-110 cm, step 2
export const lengthValues = Array.from({ length: 11 }, (_, i) => 72 + i * 2); // 72-92 cm, step 2

export function getAllowedSizeTypes(categoryId: string): SizeType[] {
  return categorySizeTypes[categoryId] ?? ["standard"];
}

export function getSizeType(categoryId: string): SizeType {
  return getAllowedSizeTypes(categoryId)[0];
}
