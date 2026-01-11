import { Alert } from 'react-native';
import { sessionManager } from './api';
import { 
  NetworkTimeoutError, 
  NetworkRetryError, 
  isRetryableError, 
  getNetworkErrorMessage 
} from './networkUtils';
import { ApiError } from './apiHelpers';

// API Error handling strategies
export enum ApiErrorStrategy {
  LOGOUT_USER = 'logout_user', // Token invalid - redirect to welcome
  SHOW_ERROR = 'show_error',   // Show error message but stay on page
  SILENT_FAIL = 'silent_fail', // Fail silently, use fallback data
  RETRY_WITH_BACKOFF = 'retry_with_backoff' // Retry with exponential backoff
}

// Error classification
export interface ApiErrorInfo {
  error: Error;
  strategy: ApiErrorStrategy;
  userMessage: string;
  shouldLogout: boolean;
  shouldShowAlert: boolean;
  isRetryable: boolean;
}

// API call context for better error handling
export interface ApiCallContext {
  pageName: string;
  operation: string;
  isCritical: boolean; // If true, failure should be more prominent
  hasFallback: boolean; // If true, can fail silently with fallback data
}

/**
 * Enhanced error handler that builds upon existing networkUtils
 * Provides intelligent error handling based on error type and context
 */
export class ApiErrorHandler {
  private static instance: ApiErrorHandler;
  private static alertShowing = false; // Global guard to prevent multiple alerts
  
  static getInstance(): ApiErrorHandler {
    if (!ApiErrorHandler.instance) {
      ApiErrorHandler.instance = new ApiErrorHandler();
    }
    return ApiErrorHandler.instance;
  }

  /**
   * Classify error and determine handling strategy
   */
  private classifyError(error: Error, context: ApiCallContext): ApiErrorInfo {
    // Authentication errors - always logout
    if (this.isAuthenticationError(error)) {
      return {
        error,
        strategy: ApiErrorStrategy.LOGOUT_USER,
        userMessage: 'Сессия истекла. Пожалуйста, войдите в систему снова.',
        shouldLogout: true,
        shouldShowAlert: false, // Session manager will handle the alert
        isRetryable: false
      };
    }

    // Network errors - check if retryable
    if (isRetryableError(error)) {
      const strategy = context.isCritical 
        ? ApiErrorStrategy.RETRY_WITH_BACKOFF 
        : ApiErrorStrategy.SHOW_ERROR;
      
      return {
        error,
        strategy,
        userMessage: getNetworkErrorMessage(error),
        shouldLogout: false,
        shouldShowAlert: context.isCritical,
        isRetryable: true
      };
    }

    // Server errors (5xx)
    if (this.isServerError(error)) {
      return {
        error,
        strategy: context.hasFallback 
          ? ApiErrorStrategy.SILENT_FAIL 
          : ApiErrorStrategy.SHOW_ERROR,
        userMessage: 'Проблема с сервером. Попробуйте позже.',
        shouldLogout: false,
        shouldShowAlert: !context.hasFallback,
        isRetryable: true
      };
    }

    // Client errors (4xx, except 401)
    if (this.isClientError(error)) {
      return {
        error,
        strategy: context.hasFallback 
          ? ApiErrorStrategy.SILENT_FAIL 
          : ApiErrorStrategy.SHOW_ERROR,
        userMessage: 'Не удалось выполнить запрос. Проверьте данные.',
        shouldLogout: false,
        shouldShowAlert: !context.hasFallback,
        isRetryable: false
      };
    }

    // Unknown errors
    return {
      error,
      strategy: context.hasFallback 
        ? ApiErrorStrategy.SILENT_FAIL 
        : ApiErrorStrategy.SHOW_ERROR,
      userMessage: 'Произошла неизвестная ошибка. Попробуйте еще раз.',
      shouldLogout: false,
      shouldShowAlert: context.isCritical,
      isRetryable: false
    };
  }

  /**
   * Handle API error with appropriate strategy
   */
  async handleApiError(
    error: Error, 
    context: ApiCallContext,
    retryFn?: () => Promise<any>
  ): Promise<void> {
    const errorInfo = this.classifyError(error, context);
    
    console.error(`API Error in ${context.pageName}/${context.operation}:`, error);

    // Handle logout case
    if (errorInfo.shouldLogout) {
      console.log(`Authentication error in ${context.pageName}/${context.operation}, triggering logout`);
      sessionManager.handleLoginRequired();
      return;
    }

    // Handle retryable errors with backoff
    if (errorInfo.isRetryable && errorInfo.strategy === ApiErrorStrategy.RETRY_WITH_BACKOFF && retryFn) {
      console.log(`Retrying ${context.operation} in ${context.pageName}...`);
      try {
        await this.retryWithBackoff(retryFn, 3);
        return;
      } catch (retryError) {
        console.error(`Retry failed for ${context.operation}:`, retryError);
        // Fall through to show error
      }
    }

    // Show alert if needed (but not if one is already showing)
    if (errorInfo.shouldShowAlert && !ApiErrorHandler.alertShowing) {
      ApiErrorHandler.alertShowing = true;
      Alert.alert(
        'Ошибка',
        errorInfo.userMessage,
        [
          {
            text: 'OK',
            style: 'default',
            onPress: () => {
              ApiErrorHandler.alertShowing = false;
            }
          },
          ...(errorInfo.isRetryable && retryFn ? [{
            text: 'Повторить',
            onPress: () => {
              ApiErrorHandler.alertShowing = false;
              retryFn();
            }
          }] : [])
        ],
        {
          onDismiss: () => {
            ApiErrorHandler.alertShowing = false;
          }
        }
      );
    }
  }

  /**
   * Retry function with exponential backoff
   */
  private async retryWithBackoff(
    fn: () => Promise<any>, 
    maxRetries: number = 3
  ): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        console.log(`Retry attempt ${attempt} failed, waiting ${delay}ms before next attempt`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Check if error is authentication related
   */
  private isAuthenticationError(error: Error): boolean {
    if (error instanceof ApiError && error.status === 401) {
      return true;
    }
    
    return error.message.includes('401') ||
           error.message.includes('unauthorized') ||
           error.message.includes('authentication') ||
           error.message.includes('token') ||
           error.message.includes('session');
  }

  /**
   * Check if error is server error (5xx)
   */
  private isServerError(error: Error): boolean {
    if (error instanceof ApiError && error.status >= 500) {
      return true;
    }
    
    return error.message.includes('500') ||
           error.message.includes('502') ||
           error.message.includes('503') ||
           error.message.includes('504') ||
           error.message.includes('server error') ||
           error.message.includes('internal error');
  }

  /**
   * Check if error is client error (4xx, except 401)
   */
  private isClientError(error: Error): boolean {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
      return true;
    }
    
    return error.message.includes('400') ||
           error.message.includes('403') ||
           error.message.includes('404') ||
           error.message.includes('422') ||
           error.message.includes('validation');
  }
}

// Export singleton instance
export const apiErrorHandler = ApiErrorHandler.getInstance();

/**
 * Convenience function to wrap API calls with error handling
 */
export async function withApiErrorHandling<T>(
  apiCall: () => Promise<T>,
  context: ApiCallContext,
  retryFn?: () => Promise<T>
): Promise<T | null> {
  try {
    return await apiCall();
  } catch (error) {
    await apiErrorHandler.handleApiError(error as Error, context, retryFn);
    return null;
  }
}

/**
 * Hook for API calls with automatic error handling
 */
export function useApiErrorHandler() {
  return {
    handleError: (error: Error, context: ApiCallContext, retryFn?: () => Promise<any>) =>
      apiErrorHandler.handleApiError(error, context, retryFn),
    withErrorHandling: withApiErrorHandling
  };
}
