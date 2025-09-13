import { colors } from './colors';
import { materials } from './materials';

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
