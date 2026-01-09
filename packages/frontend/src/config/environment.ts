// Environment configuration interface
interface EnvironmentConfig {
  API_BASE_URL: string;
  API_TIMEOUT: number;
  AUTH_TIMEOUT: number;
  DEBUG_MODE: boolean;
  LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
  ENABLE_DEV_TOOLS: boolean;
}

// Get environment from Vite environment variables
const getEnvironment = (): 'development' | 'staging' | 'production' => {
  const env = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE;
  
  if (env === 'staging' || env === 'production') {
    return env;
  }
  
  // Fallback to development
  return 'development';
};

const environment = getEnvironment();

// Configuration for different environments
const configs: Record<string, EnvironmentConfig> = {
  development: {
    API_BASE_URL: import.meta.env.VITE_API_URL,
    API_TIMEOUT: 10000,
    AUTH_TIMEOUT: 20000,
    DEBUG_MODE: true,
    LOG_LEVEL: 'debug',
    ENABLE_DEV_TOOLS: true,
  },
  
  staging: {
    API_BASE_URL: import.meta.env.VITE_API_URL,
    API_TIMEOUT: 15000,
    AUTH_TIMEOUT: 25000,
    DEBUG_MODE: true,
    LOG_LEVEL: 'info',
    ENABLE_DEV_TOOLS: true,
  },
  
  production: {
    API_BASE_URL: import.meta.env.VITE_API_URL,
    API_TIMEOUT: 10000,
    AUTH_TIMEOUT: 20000,
    DEBUG_MODE: false,
    LOG_LEVEL: 'error',
    ENABLE_DEV_TOOLS: false,
  },
};

// Get current configuration
const currentConfig = configs[environment];

// Export configuration object
export const ENV_CONFIG = {
  // Core API settings
  API_BASE_URL: currentConfig.API_BASE_URL,
  API_TIMEOUT: currentConfig.API_TIMEOUT,
  AUTH_TIMEOUT: currentConfig.AUTH_TIMEOUT,
  
  // Environment info
  ENVIRONMENT: environment,
  IS_PRODUCTION: environment === 'production',
  IS_DEVELOPMENT: environment === 'development',
  IS_STAGING: environment === 'staging',
  
  // Debug settings
  DEBUG_MODE: currentConfig.DEBUG_MODE,
  LOG_LEVEL: currentConfig.LOG_LEVEL,
  ENABLE_DEV_TOOLS: currentConfig.ENABLE_DEV_TOOLS,
  
  // Additional Vite environment variables
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
  VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
};

// Utility functions
export const isProduction = (): boolean => ENV_CONFIG.IS_PRODUCTION;
export const isDevelopment = (): boolean => ENV_CONFIG.IS_DEVELOPMENT;
export const isStaging = (): boolean => ENV_CONFIG.IS_STAGING;

// Logging utility
export const log = {
  debug: (message: string, ...args: any[]) => {
    if (ENV_CONFIG.DEBUG_MODE && ['debug'].includes(ENV_CONFIG.LOG_LEVEL)) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (['debug', 'info'].includes(ENV_CONFIG.LOG_LEVEL)) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(ENV_CONFIG.LOG_LEVEL)) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },
};

// Validate configuration
export const validateConfig = (): boolean => {
  try {
    if (!ENV_CONFIG.API_BASE_URL) {
      const errorMsg = 'API_BASE_URL is not configured. Please set VITE_API_URL environment variable during build.';
      log.error(errorMsg);
      if (typeof window !== 'undefined') {
        console.error('%c' + errorMsg, 'color: red; font-size: 16px; font-weight: bold;');
      }
      return false;
    }
    
    if (ENV_CONFIG.API_TIMEOUT <= 0) {
      log.error('API_TIMEOUT must be greater than 0');
      return false;
    }
    
    if (ENV_CONFIG.AUTH_TIMEOUT <= 0) {
      log.error('AUTH_TIMEOUT must be greater than 0');
      return false;
    }
    
    log.info(`Configuration validated successfully for ${ENV_CONFIG.ENVIRONMENT} environment`);
    log.info(`API Base URL: ${ENV_CONFIG.API_BASE_URL}`);
    
    return true;
  } catch (error) {
    log.error('Configuration validation failed:', error);
    return false;
  }
};

// Initialize configuration
export const initializeConfig = (): boolean => {
  const isValid = validateConfig();
  
  if (isValid) {
    log.info('Configuration initialized successfully');
  } else {
    log.error('Configuration initialization failed');
  }
  
  return isValid;
};
