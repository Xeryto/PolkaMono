// Network utilities for timeout handling and retry logic
import { ApiError } from './apiHelpers';

export interface NetworkConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
  retryBackoff: boolean;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  signal?: AbortSignal;
}

export class NetworkTimeoutError extends Error {
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'NetworkTimeoutError';
  }
}

export class NetworkRetryError extends Error {
  public attempts: number;
  public lastError: Error;

  constructor(message: string, attempts: number, lastError: Error) {
    super(message);
    this.name = 'NetworkRetryError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

// Default network configuration
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  timeout: 10000, // 10 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  retryBackoff: true,
};

// Create timeout promise
const createTimeoutPromise = (timeoutMs: number): Promise<never> => {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new NetworkTimeoutError(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
};

// Calculate retry delay with exponential backoff
const calculateRetryDelay = (baseDelay: number, attempt: number, useBackoff: boolean): number => {
  if (!useBackoff) return baseDelay;
  return baseDelay * Math.pow(2, attempt - 1);
};

// Sleep utility
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Enhanced fetch with timeout and retry logic
export const fetchWithTimeoutAndRetry = async (
  url: string,
  options: RequestInit = {},
  requestOptions: RequestOptions = {}
): Promise<Response> => {
  const config = { ...DEFAULT_NETWORK_CONFIG, ...requestOptions };
  const { timeout, retries, retryDelay, retryBackoff } = config;
  
  let lastError: Error;
  
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      // Create abort controller for this attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // Merge abort signals if provided
      const signal = requestOptions.signal 
        ? AbortSignal.any([controller.signal, requestOptions.signal])
        : controller.signal;
      
      // Make the request
      const response = await fetch(url, {
        ...options,
        signal,
      });
      
      // Clear timeout if request completes
      clearTimeout(timeoutId);
      
      return response;
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (lastError instanceof NetworkTimeoutError || 
          lastError.name === 'AbortError' ||
          (lastError as any)?.code === 'NETWORK_ERROR') {
        
        // If this was the last attempt, throw the error
        if (attempt === retries + 1) {
          if (retries > 0) {
            throw new NetworkRetryError(
              `Request failed after ${attempt} attempts`,
              attempt,
              lastError
            );
          }
          throw lastError;
        }
        
        // Wait before retrying
        const delay = calculateRetryDelay(retryDelay, attempt, retryBackoff);
        await sleep(delay);
        continue;
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
  
  // This should never be reached, but just in case
  throw new NetworkRetryError(
    `Request failed after ${retries + 1} attempts`,
    retries + 1,
    lastError!
  );
};

// Utility to check if error is retryable
export const isRetryableError = (error: Error): boolean => {
  return error instanceof NetworkTimeoutError ||
         error.name === 'AbortError' ||
         error.name === 'NetworkRetryError' ||
         (error as any)?.code === 'NETWORK_ERROR' ||
         (error as any)?.message?.includes('timeout') ||
         (error as any)?.message?.includes('network');
};

// Utility to get user-friendly error message
export const getNetworkErrorMessage = (error: Error): string => {
  if (error instanceof NetworkTimeoutError) {
    return 'Запрос выполняется слишком долго. Проверьте подключение к интернету.';
  }
  
  if (error instanceof NetworkRetryError) {
    return `Не удалось выполнить запрос после ${error.attempts} попыток. Проверьте подключение к интернету.`;
  }
  
  if (error.name === 'AbortError') {
    return 'Запрос был отменен. Проверьте подключение к интернету.';
  }
  
  if (isRetryableError(error)) {
    return 'Проблемы с подключением к интернету. Попробуйте еще раз.';
  }
  
  return error.message || 'Произошла неизвестная ошибка.';
};
