import { Platform } from 'react-native';

// Environment-aware configuration
const DEV_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000'; // Your local backend URL
const PROD_API_URL = 'https://polkaapi.onrender.com'; // Your production backend URL

// The __DEV__ global variable is set to true in development mode by React Native.
const isDevelopment = __DEV__;

// API Configuration
export const API_CONFIG = {
  // Set to true to use real API endpoints, false to use simulated endpoints
  USE_REAL_API: true,
  
  // API Base URL - selected at runtime based on the environment
  API_BASE_URL: isDevelopment ? DEV_API_URL : PROD_API_URL,
  
  // Development settings
  DEV: {
    // Simulated API delay in milliseconds
    API_DELAY: 500,
    
    // Demo credentials for testing
    DEMO_EMAIL: 'demo@example.com',
    DEMO_PASSWORD: 'password123',
  },
  
  // Production settings
  PROD: {
    // Real API timeout in milliseconds
    API_TIMEOUT: 10000,
  },

  // SSL Pinning Configuration
  SSL_PINNING_CONFIG: {
    // Add your server's SSL certificate hashes here
    // Example: 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    CERTIFICATES: [],
  }
};

// Helper function to get the appropriate API function
export const getApiFunction = (simulatedFn: any, realFn: any) => {
  return API_CONFIG.USE_REAL_API ? realFn : simulatedFn;
};

export const isProduction = () => {
  return !__DEV__;
}; 