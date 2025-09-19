// Color and material translations for mobile app
const colors = [
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

const materials = [
  { name: "cotton", russian: "Хлопок" },
  { name: "polyester", russian: "Полиэстер" },
  { name: "wool", russian: "Шерсть" },
  { name: "silk", russian: "Шелк" },
  { name: "linen", russian: "Лен" },
  { name: "spandex", russian: "Спандекс" },
  { name: "nylon", russian: "Нейлон" },
  { name: "denim", russian: "Деним" },
  { name: "leather", russian: "Кожа" },
  { name: "fleece", russian: "Флис" },
];

/**
 * Translates English color names to Russian with proper capitalization
 */
export const translateColorToRussian = (colorString?: string): string => {
  if (!colorString) return '';
  
  return colorString
    .split(', ')
    .map(color => {
      const trimmedColor = color.trim();
      const colorOption = colors.find(c => c.name === trimmedColor);
      return colorOption ? colorOption.russian : trimmedColor;
    })
    .join(', ');
};

/**
 * Translates English material names to Russian with proper capitalization
 */
export const translateMaterialToRussian = (materialString?: string): string => {
  if (!materialString) return '';
  
  return materialString
    .split(', ')
    .map(material => {
      const trimmedMaterial = material.trim();
      const materialOption = materials.find(m => m.name === trimmedMaterial);
      return materialOption ? materialOption.russian : trimmedMaterial;
    })
    .join(', ');
};

/**
 * Capitalizes the first letter of each word in a string
 */
export const capitalizeWords = (str: string): string => {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Gets the hex color for a given color name
 */
export const getColorHex = (colorName: string): string => {
  const colorOption = colors.find(c => c.name === colorName);
  return colorOption ? colorOption.hex : '#000000';
};

