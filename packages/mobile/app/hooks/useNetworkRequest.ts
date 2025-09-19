import { useState, useCallback, useRef } from 'react';
import { RequestOptions } from '../services/networkUtils';

interface UseNetworkRequestOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: (data: any) => void;
  onRetry?: (attempt: number) => void;
}

interface UseNetworkRequestReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
  isRetrying: boolean;
  attemptCount: number;
}

export const useNetworkRequest = <T = any>(
  requestFn: (...args: any[]) => Promise<T>,
  options: UseNetworkRequestOptions = {}
): UseNetworkRequestReturn<T> => {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    retryBackoff = true,
    onError,
    onSuccess,
    onRetry,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  
  const lastArgsRef = useRef<any[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    // Store args for retry
    lastArgsRef.current = args;
    
    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setError(null);
    setAttemptCount(0);
    
    const requestOptions: RequestOptions = {
      timeout,
      retries,
      retryDelay,
      retryBackoff,
      signal: abortControllerRef.current.signal,
    };

    try {
      const result = await requestFn(...args, requestOptions);
      setData(result);
      setError(null);
      onSuccess?.(result);
      return result;
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [timeout, retries, retryDelay, retryBackoff, onError, onSuccess]); // Remove requestFn from dependencies

  const retry = useCallback(async (): Promise<T | null> => {
    if (lastArgsRef.current.length === 0) {
      return null;
    }
    
    setIsRetrying(true);
    onRetry?.(attemptCount + 1);
    
    return execute(...lastArgsRef.current);
  }, [execute, attemptCount, onRetry]);

  const reset = useCallback(() => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setData(null);
    setError(null);
    setIsLoading(false);
    setIsRetrying(false);
    setAttemptCount(0);
    lastArgsRef.current = [];
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    retry,
    reset,
    isRetrying,
    attemptCount,
  };
};
