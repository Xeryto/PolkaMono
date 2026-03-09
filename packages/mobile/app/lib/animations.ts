import { Easing } from 'react-native';

// ============================================================================
// DURATION CONSTANTS (in milliseconds)
// ============================================================================

export const ANIMATION_DURATIONS = {
  MICRO: 80,
  FAST: 150,
  SHORT: 200,
  STANDARD: 300,
  CARD_FLIP: 350,
  MEDIUM: 500,
  EXTENDED: 600,
  LONG: 800,
  VERY_LONG: 1200,
  QUICK: 100,
  SWIPE_EXIT: 220,
} as const;

// ============================================================================
// DELAY CONSTANTS (in milliseconds)
// ============================================================================

export const ANIMATION_DELAYS = {
  NONE: 0,
  MICRO: 25,
  SMALL: 50,
  STANDARD: 100,
  MEDIUM: 150,
  LARGE: 200,
  EXTENDED: 250,
  VERY_LARGE: 300,
  MAXIMUM: 350,
  LIST_ITEM_INCREMENT: 50,
} as const;

// ============================================================================
// EASING CONSTANTS
// ============================================================================

export const ANIMATION_EASING = {
  STANDARD: Easing.out(Easing.ease),
  CUBIC: Easing.inOut(Easing.cubic),
  LINEAR: Easing.linear,
  DECELERATE: Easing.out(Easing.cubic),
  SYMMETRIC: Easing.inOut(Easing.ease),
  ACCELERATE: Easing.in(Easing.cubic),
} as const;

// ============================================================================
// SPRING CONFIG PRESETS (for react-native-reanimated withSpring)
// ============================================================================

export const SPRING_CONFIGS = {
  HEART_BOUNCE: { mass: 0.2, damping: 12, stiffness: 600 },
  PRESS_SCALE: { mass: 0.3, damping: 15, stiffness: 500 },
  DOUBLE_TAP_IN: { damping: 8, stiffness: 200 },
  DOUBLE_TAP_OUT: { damping: 10, stiffness: 150 },
  SNAP_BACK: { friction: 5, tension: 40 },
} as const;

// ============================================================================
// ANIMATION PRESETS
// ============================================================================

export const ANIMATION_PRESETS = {
  SCREEN_TRANSITION: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.STANDARD,
  },
  BUTTON_PRESS: {
    duration: ANIMATION_DURATIONS.FAST,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.SYMMETRIC,
  },
  LIST_ITEM: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.SMALL,
    easing: ANIMATION_EASING.STANDARD,
  },
  MODAL: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.CUBIC,
  },
  LOADING: {
    duration: ANIMATION_DURATIONS.LONG,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.LINEAR,
  },
  HEART_ANIMATION: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.DECELERATE,
  },
  CARD_SWIPE: {
    duration: ANIMATION_DURATIONS.FAST,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.STANDARD,
  },
  SIZE_SELECTION: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.STANDARD,
  },
  SEARCH: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.CUBIC,
  },
  FORM_FIELD: {
    duration: ANIMATION_DURATIONS.STANDARD,
    delay: ANIMATION_DELAYS.SMALL,
    easing: ANIMATION_EASING.STANDARD,
  },
  PAGE_FADE: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.NONE,
    easing: ANIMATION_EASING.STANDARD,
  },
  STAGGERED_ENTRANCE: {
    duration: ANIMATION_DURATIONS.MEDIUM,
    delay: ANIMATION_DELAYS.SMALL,
    easing: ANIMATION_EASING.STANDARD,
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const MAX_STAGGER_DELAY = 600;

export const getStaggeredDelay = (index: number, baseDelay: number = ANIMATION_DELAYS.SMALL): number => {
  return Math.min(baseDelay + index * ANIMATION_DELAYS.LIST_ITEM_INCREMENT, MAX_STAGGER_DELAY);
};

export const getProgressiveDelay = (index: number, increment: number = ANIMATION_DELAYS.SMALL): number => {
  return index * increment;
};

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

export const getFadeInDownAnimation = (delay?: number, duration?: number) => ({
  duration: duration || ANIMATION_DURATIONS.MEDIUM,
  delay: delay || ANIMATION_DELAYS.NONE,
});

export const getFadeOutDownAnimation = (delay?: number, duration?: number) => ({
  duration: duration || ANIMATION_DURATIONS.STANDARD,
  delay: delay || ANIMATION_DELAYS.NONE,
});

export const getFadeInAnimation = (delay?: number, duration?: number) => ({
  duration: duration || ANIMATION_DURATIONS.MEDIUM,
  delay: delay || ANIMATION_DELAYS.NONE,
});

export const getFadeOutAnimation = (delay?: number, duration?: number) => ({
  duration: duration || ANIMATION_DURATIONS.STANDARD,
  delay: delay || ANIMATION_DELAYS.NONE,
});

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type AnimationDuration = typeof ANIMATION_DURATIONS[keyof typeof ANIMATION_DURATIONS];
export type AnimationDelay = typeof ANIMATION_DELAYS[keyof typeof ANIMATION_DELAYS];
export type AnimationPreset = typeof ANIMATION_PRESETS[keyof typeof ANIMATION_PRESETS];
