/**
 * Standardized animation constants for consistent timing across all mobile screens
 * 
 * This file provides centralized animation timing values to ensure a cohesive
 * user experience throughout the mobile application.
 */

// ============================================================================
// DURATION CONSTANTS (in milliseconds)
// ============================================================================

export const ANIMATION_DURATIONS = {
  // Fast animations for immediate feedback
  FAST: 150,
  
  // Standard animations for most UI transitions
  STANDARD: 300,
  
  // Medium animations for more noticeable transitions
  MEDIUM: 500,
  
  // Long animations for complex or dramatic effects
  LONG: 800,
  
  // Very long animations for special cases (like loading screens)
  VERY_LONG: 1200,
  
  // Micro animations for subtle feedback
  MICRO: 80,
  
  // Short animations for quick transitions
  SHORT: 200,
  
  // Extended animations for complex sequences
  EXTENDED: 600,
  
  // Quick animations for responsive feel
  QUICK: 100,
} as const;

// ============================================================================
// DELAY CONSTANTS (in milliseconds)
// ============================================================================

export const ANIMATION_DELAYS = {
  // No delay
  NONE: 0,
  
  // Micro delay for staggered animations
  MICRO: 25,
  
  // Small delay for subtle staggering
  SMALL: 50,
  
  // Standard delay for typical staggered animations
  STANDARD: 100,
  
  // Medium delay for more noticeable staggering
  MEDIUM: 150,
  
  // Large delay for dramatic effect
  LARGE: 200,
  
  // Extended delay for special cases
  EXTENDED: 250,
  
  // Very large delay for complex sequences
  VERY_LARGE: 300,
  
  // Maximum delay for special effects
  MAXIMUM: 350,
  
  // Progressive delays for list items (incremental)
  LIST_ITEM_INCREMENT: 50,
} as const;

// ============================================================================
// EASING CONSTANTS
// ============================================================================

import { Easing } from 'react-native';

export const ANIMATION_EASING = {
  // Standard easing for most animations
  STANDARD: Easing.out(Easing.ease),
  
  // Cubic easing for smooth transitions
  CUBIC: Easing.inOut(Easing.cubic),
  
  // Linear easing for consistent speed
  LINEAR: Easing.linear,
  
  // Spring-like easing for bouncy effects
  SPRING: Easing.out(Easing.cubic),
  
  // Quick ease for responsive feel
  QUICK: Easing.inOut(Easing.ease),
  
  // Smooth ease for gentle transitions
  SMOOTH: Easing.out(Easing.ease),
} as const;

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

/**
 * Common animation configurations for different use cases
 */
export const ANIMATION_PRESETS = {
  // Screen transitions
  SCREEN_TRANSITION: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.STANDARD,
  },
  
  // Button press feedback
  BUTTON_PRESS: {
    duration: ANIMATION_DURATIONS.FAST,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.QUICK,
  },
  
  // List item animations
  LIST_ITEM: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.SMALL,
    easing: ANIMATION_EASING.STANDARD,
  },
  
  // Modal animations
  MODAL: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.CUBIC,
  },
  
  // Loading animations
  LOADING: {
    duration: ANIMATION_DURATIONS.LONG,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.LINEAR,
  },
  
  // Heart/like animations
  HEART_ANIMATION: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.SPRING,
  },
  
  // Card swipe animations
  CARD_SWIPE: {
    duration: ANIMATION_DURATIONS.FAST,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.SMOOTH,
  },
  
  // Size selection animations
  SIZE_SELECTION: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.STANDARD,
  },
  
  // Search animations
  SEARCH: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.CUBIC,
  },
  
  // Form field animations
  FORM_FIELD: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.SMALL,
    easing: ANIMATION_EASING.STANDARD,
  },
  
  // Page fade animations
  PAGE_FADE: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.SMOOTH,
  },
  
  // Staggered entrance animations
  STAGGERED_ENTRANCE: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.SMALL,
    easing: ANIMATION_EASING.STANDARD,
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a staggered delay for list items
 * @param index - The index of the item in the list
 * @param baseDelay - The base delay to start from (default: ANIMATION_DELAYS.SMALL)
 * @returns The calculated delay for the item
 */
export const getStaggeredDelay = (index: number, baseDelay: number = ANIMATION_DELAYS.SMALL): number => {
  return baseDelay + (index * ANIMATION_DELAYS.LIST_ITEM_INCREMENT);
};

/**
 * Get a progressive delay for multiple elements
 * @param index - The index of the element
 * @param increment - The increment value (default: ANIMATION_DELAYS.SMALL)
 * @returns The calculated delay for the element
 */
export const getProgressiveDelay = (index: number, increment: number = ANIMATION_DELAYS.SMALL): number => {
  return index * increment;
};

/**
 * Create an animation configuration object
 * @param duration - Animation duration
 * @param delay - Animation delay
 * @param easing - Animation easing function
 * @returns Animation configuration object
 */
export const createAnimationConfig = (
  duration: number,
  delay: number = ANIMATION_DELAYS.NONE,
  easing: any = ANIMATION_EASING.STANDARD
) => ({
  duration,
  delay,
  easing,
});

// ============================================================================
// REANIMATED ANIMATION HELPERS
// ============================================================================

/**
 * Get FadeInDown animation with standardized timing
 * @param delay - Optional delay override
 * @param duration - Optional duration override
 * @returns FadeInDown animation configuration
 */
export const getFadeInDownAnimation = (delay?: number, duration?: number) => {
  return {
    duration: duration || ANIMATION_DURATIONS.MEDIUM,
    delay: delay || ANIMATION_DELAYS.NONE,
  };
};

/**
 * Get FadeOutDown animation with standardized timing
 * @param delay - Optional delay override
 * @param duration - Optional duration override
 * @returns FadeOutDown animation configuration
 */
export const getFadeOutDownAnimation = (delay?: number, duration?: number) => {
  return {
    duration: duration || ANIMATION_DURATIONS.STANDARD,
    delay: delay || ANIMATION_DELAYS.NONE,
  };
};

/**
 * Get FadeIn animation with standardized timing
 * @param delay - Optional delay override
 * @param duration - Optional duration override
 * @returns FadeIn animation configuration
 */
export const getFadeInAnimation = (delay?: number, duration?: number) => {
  return {
    duration: duration || ANIMATION_DURATIONS.MEDIUM,
    delay: delay || ANIMATION_DELAYS.NONE,
  };
};

/**
 * Get FadeOut animation with standardized timing
 * @param delay - Optional delay override
 * @param duration - Optional duration override
 * @returns FadeOut animation configuration
 */
export const getFadeOutAnimation = (delay?: number, duration?: number) => {
  return {
    duration: duration || ANIMATION_DURATIONS.STANDARD,
    delay: delay || ANIMATION_DELAYS.NONE,
  };
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AnimationDuration = typeof ANIMATION_DURATIONS[keyof typeof ANIMATION_DURATIONS];
export type AnimationDelay = typeof ANIMATION_DELAYS[keyof typeof ANIMATION_DELAYS];
export type AnimationPreset = typeof ANIMATION_PRESETS[keyof typeof ANIMATION_PRESETS];
