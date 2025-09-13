// Network testing utilities for simulating slow connections and timeouts
import { fetchWithTimeoutAndRetry, RequestOptions } from './networkUtils';

// Simulate slow network by adding delay
export const simulateSlowNetwork = (delayMs: number) => {
  return new Promise(resolve => setTimeout(resolve, delayMs));
};

// Create a mock fetch that simulates network conditions
export const createMockFetch = (options: {
  delay?: number;
  shouldFail?: boolean;
  failAfterAttempts?: number;
  responseData?: any;
  status?: number;
}) => {
  const { delay = 0, shouldFail = false, failAfterAttempts = 1, responseData = {}, status = 200 } = options;
  let attemptCount = 0;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    attemptCount++;
    
    // Simulate delay
    if (delay > 0) {
      await simulateSlowNetwork(delay);
    }
    
    // Simulate failure after certain attempts
    if (shouldFail && attemptCount <= failAfterAttempts) {
      const error = new Error('Network request failed');
      (error as any).code = 'NETWORK_ERROR';
      throw error;
    }
    
    // Return successful response
    return new Response(JSON.stringify(responseData), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };
};

// Test timeout scenarios
export const testTimeoutScenarios = async () => {
  console.log('🧪 Testing network timeout scenarios...');
  
  // Test 1: Normal request (should succeed)
  console.log('Test 1: Normal request');
  try {
    const response = await fetchWithTimeoutAndRetry(
      'https://httpbin.org/delay/1',
      {},
      { timeout: 5000, retries: 1 }
    );
    console.log('✅ Normal request succeeded');
    } catch (error) {
      console.log('❌ Normal request failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Test 2: Timeout scenario
  console.log('Test 2: Timeout scenario');
  try {
    const response = await fetchWithTimeoutAndRetry(
      'https://httpbin.org/delay/15', // This will timeout
      {},
      { timeout: 3000, retries: 1 }
    );
    console.log('❌ Timeout test should have failed');
  } catch (error) {
    console.log('✅ Timeout test correctly failed:', error instanceof Error ? error.message : String(error));
  }
  
  // Test 3: Retry scenario
  console.log('Test 3: Retry scenario');
  try {
    const response = await fetchWithTimeoutAndRetry(
      'https://httpbin.org/status/500', // This will fail
      {},
      { timeout: 5000, retries: 2, retryDelay: 1000 }
    );
    console.log('❌ Retry test should have failed');
  } catch (error) {
    console.log('✅ Retry test correctly failed after retries:', error instanceof Error ? error.message : String(error));
  }
  
  console.log('🧪 Network timeout tests completed');
};

// Simulate different network conditions for testing
export const simulateNetworkConditions = {
  // Fast connection (100ms)
  fast: () => createMockFetch({ delay: 100 }),
  
  // Slow connection (2 seconds)
  slow: () => createMockFetch({ delay: 2000 }),
  
  // Very slow connection (8 seconds - should timeout)
  verySlow: () => createMockFetch({ delay: 8000 }),
  
  // Intermittent failures (fails first 2 attempts, succeeds on 3rd)
  intermittent: () => createMockFetch({ 
    delay: 1000, 
    shouldFail: true, 
    failAfterAttempts: 2 
  }),
  
  // Complete failure
  failed: () => createMockFetch({ 
    delay: 100, 
    shouldFail: true, 
    failAfterAttempts: 10 
  }),
};

// Helper to test network request with different conditions
export const testNetworkCondition = async (
  condition: keyof typeof simulateNetworkConditions,
  requestOptions: RequestOptions = {}
) => {
  console.log(`🧪 Testing ${condition} network condition...`);
  
  // Mock the global fetch
  const originalFetch = window.fetch;
  window.fetch = simulateNetworkConditions[condition]() as any;
  
  try {
    const response = await fetchWithTimeoutAndRetry(
      'https://example.com/api/test',
      {},
      { timeout: 5000, retries: 3, ...requestOptions }
    );
    console.log(`✅ ${condition} condition test succeeded`);
    return { success: true, response };
  } catch (error) {
    console.log(`❌ ${condition} condition test failed:`, error instanceof Error ? error.message : String(error));
    return { success: false, error };
  } finally {
    // Restore original fetch
    window.fetch = originalFetch;
  }
};
