import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Debug environment variables
console.log('Environment variables debug:', {
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT,
  EXPO_PUBLIC_API_TIMEOUT: process.env.EXPO_PUBLIC_API_TIMEOUT,
  EXPO_PUBLIC_AUTH_TIMEOUT: process.env.EXPO_PUBLIC_AUTH_TIMEOUT,
  EXPO_PUBLIC_DEBUG_MODE: process.env.EXPO_PUBLIC_DEBUG_MODE,
  EXPO_PUBLIC_LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL,
  isEASUpdate: Constants.expoConfig?.extra?.isEASUpdate,
  isDevelopmentBuild: Constants.expoConfig?.extra?.isDevelopmentBuild,
});

// Determine if this is an EAS update (production build with OTA update)
const isEASUpdate = Constants.expoConfig?.extra?.isEASUpdate === true;
const isDevelopmentBuild = Constants.expoConfig?.extra?.isDevelopmentBuild === true;

// Standard Expo environment configuration using EXPO_PUBLIC_ variables
export const API_CONFIG = {
  // API Configuration - Use production URL for EAS updates, local for development
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL,
  API_TIMEOUT: parseInt(process.env.EXPO_PUBLIC_API_TIMEOUT),
  AUTH_TIMEOUT: parseInt(process.env.EXPO_PUBLIC_AUTH_TIMEOUT),
  
  // Environment
  ENVIRONMENT: process.env.EXPO_PUBLIC_ENVIRONMENT,
  IS_PRODUCTION: process.env.EXPO_PUBLIC_ENVIRONMENT === 'production',
  IS_DEVELOPMENT: process.env.EXPO_PUBLIC_ENVIRONMENT !== 'production',
  
  // Debug settings
  DEBUG_MODE: process.env.EXPO_PUBLIC_DEBUG_MODE === 'true',
  LOG_LEVEL: process.env.EXPO_PUBLIC_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error',
  
  // Development settings (only available in development)
  DEV: {
    API_DELAY: parseInt(process.env.EXPO_PUBLIC_API_DELAY),
  },
  
  // SSL Pinning Configuration
  SSL_PINNING_CONFIG: {
    CERTIFICATES: process.env.EXPO_PUBLIC_SSL_CERTIFICATES ? 
      process.env.EXPO_PUBLIC_SSL_CERTIFICATES.split(',') : [],
  },
};

// Utility functions
export const isProduction = (): boolean => API_CONFIG.IS_PRODUCTION;
export const isDevelopment = (): boolean => API_CONFIG.IS_DEVELOPMENT;

// Logging utility
export const log = {
  debug: (message: string, ...args: any[]) => {
    if (API_CONFIG.DEBUG_MODE && ['debug'].includes(API_CONFIG.LOG_LEVEL)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (['debug', 'info'].includes(API_CONFIG.LOG_LEVEL)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(API_CONFIG.LOG_LEVEL)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

// Initialize configuration
export const initializeConfig = (): boolean => {
  log.info(`Configuration initialized for ${API_CONFIG.ENVIRONMENT} environment`);
  log.info(`API Base URL: ${API_CONFIG.API_BASE_URL}`);
  return true;
};