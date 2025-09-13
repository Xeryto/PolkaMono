# Network Timeout and Retry Implementation

This document describes the comprehensive timeout and retry system implemented to handle slow internet connections and network failures in the Polka application.

## 🚀 **Overview**

The app now includes robust network handling that prevents users from skipping over content due to slow loading times. The system provides:

- **Automatic timeouts** for all network requests
- **Retry logic** with exponential backoff
- **User-friendly loading indicators** with progress feedback
- **Timeout warnings** when requests take longer than expected
- **Retry buttons** for failed requests
- **Graceful error handling** with localized messages

## 🏗️ **Architecture**

### **Core Components**

1. **Network Utilities** (`networkUtils.ts`)

   - Enhanced fetch with timeout and retry logic
   - Error classification and user-friendly messages
   - Configurable timeout and retry settings

2. **Loading Indicators** (`NetworkLoadingIndicator.tsx`)

   - Progress bars showing request progress
   - Timeout warnings at 70% of timeout duration
   - Retry buttons for failed requests
   - Different styles for mobile and frontend

3. **Custom Hooks** (`useNetworkRequest.ts`)

   - React hooks for managing network requests
   - Built-in loading states and error handling
   - Automatic retry functionality

4. **API Service Updates**
   - All API functions now support timeout configuration
   - Automatic retry on network failures
   - Enhanced error messages

## ⚙️ **Configuration**

### **Default Settings**

```typescript
const DEFAULT_NETWORK_CONFIG = {
  timeout: 10000, // 10 seconds
  retries: 3, // 3 retry attempts
  retryDelay: 1000, // 1 second base delay
  retryBackoff: true, // Exponential backoff
};
```

### **Per-Request Configuration**

```typescript
// Mobile API call with custom timeout
const response = await apiRequest("/api/v1/products", "GET", undefined, true, {
  timeout: 15000, // 15 seconds for products
  retries: 2, // 2 retry attempts
});

// Frontend API call with custom settings
const products = await api.getBrandProducts(token, {
  timeout: 20000, // 20 seconds
  retries: 1, // 1 retry attempt
});
```

## 📱 **Mobile Implementation**

### **Enhanced API Service**

The mobile API service (`packages/mobile/app/services/api.ts`) now includes:

- **Timeout handling** using `fetchWithTimeoutAndRetry`
- **Automatic retry** on network failures
- **User-friendly error messages** in Russian
- **Configurable timeouts** per request type

### **Loading Components**

The mobile app includes `NetworkLoadingIndicator` with:

- **Progress visualization** showing request progress
- **Timeout warnings** when requests take too long
- **Retry functionality** with visual feedback
- **Error display** with actionable retry buttons

### **Usage Example**

```typescript
// In a React Native screen
const {
  data: products,
  isLoading,
  error,
  execute: fetchProducts,
  retry: retryFetchProducts,
} = useNetworkRequest(async () => await api.getBrandProducts(), {
  timeout: 15000,
  retries: 2,
  onError: (error) => showErrorToast(error.message),
});

// In render
<NetworkLoadingIndicator
  isLoading={isLoading}
  error={error}
  onRetry={retryFetchProducts}
  timeout={15000}
  message="Загрузка товаров..."
/>;
```

## 🌐 **Frontend Implementation**

### **Enhanced API Service**

The frontend API service (`packages/frontend/src/services/api.ts`) includes:

- **Timeout handling** for all requests
- **Retry logic** with configurable settings
- **Error classification** and user-friendly messages
- **Request cancellation** support

### **Loading Components**

The frontend includes a styled `NetworkLoadingIndicator` with:

- **Progress bars** using shadcn/ui components
- **Timeout warnings** with appropriate styling
- **Retry buttons** with loading states
- **Error display** with clear messaging

### **Usage Example**

```typescript
// In a React component
const {
  data: products,
  isLoading,
  error,
  execute: fetchProducts,
  retry: retryFetchProducts,
} = useNetworkRequest(
  async (token: string) => await api.getBrandProducts(token),
  {
    timeout: 15000,
    retries: 2,
    onError: (error) => toast({ title: "Ошибка", description: error.message }),
  }
);

// In render
<NetworkLoadingIndicator
  isLoading={isLoading}
  error={error}
  onRetry={retryFetchProducts}
  timeout={15000}
  message="Загрузка товаров..."
  className="mb-4"
/>;
```

## 🔄 **Retry Logic**

### **Exponential Backoff**

The system uses exponential backoff for retry delays:

```typescript
// Attempt 1: 1000ms delay
// Attempt 2: 2000ms delay
// Attempt 3: 4000ms delay
const delay = baseDelay * Math.pow(2, attempt - 1);
```

### **Retry Conditions**

Requests are retried on:

- **Network timeouts**
- **Connection failures**
- **Temporary network errors**

Requests are NOT retried on:

- **Authentication errors** (401)
- **Validation errors** (400)
- **Server errors** (500)
- **Client-side errors**

## ⚠️ **Error Handling**

### **Error Classification**

The system classifies errors into categories:

1. **NetworkTimeoutError** - Request exceeded timeout
2. **NetworkRetryError** - Request failed after retries
3. **ApiError** - Server returned error response
4. **Generic Error** - Other unexpected errors

### **User-Friendly Messages**

All errors are translated to user-friendly Russian messages:

```typescript
// Timeout error
"Запрос выполняется слишком долго. Проверьте подключение к интернету.";

// Retry error
"Не удалось выполнить запрос после 3 попыток. Проверьте подключение к интернету.";

// Network error
"Проблемы с подключением к интернету. Попробуйте еще раз.";
```

## 🧪 **Testing**

### **Test Utilities**

The implementation includes comprehensive test utilities:

```typescript
// Test different network conditions
await testNetworkCondition("slow"); // 2 second delay
await testNetworkCondition("verySlow"); // 8 second delay (timeout)
await testNetworkCondition("intermittent"); // Fails first 2 attempts
await testNetworkCondition("failed"); // Always fails
```

### **Manual Testing**

To test timeout scenarios:

1. **Slow Network**: Use browser dev tools to throttle connection
2. **Timeout Testing**: Set very low timeout values
3. **Retry Testing**: Disconnect network temporarily
4. **Error Handling**: Test with invalid endpoints

## 📊 **Performance Impact**

### **Benefits**

- **Improved UX**: Users see progress and can retry failed requests
- **Reduced Support**: Fewer "app not working" complaints
- **Better Reliability**: Automatic retry handles temporary failures
- **Clear Feedback**: Users understand what's happening

### **Overhead**

- **Minimal**: Retry logic only activates on failures
- **Configurable**: Timeouts can be adjusted per request type
- **Cancellable**: Requests can be cancelled to prevent unnecessary retries

## 🔧 **Customization**

### **Per-Request Timeouts**

Different request types can have different timeouts:

```typescript
// Quick requests (5 seconds)
const quickRequest = await apiRequest(
  "/api/v1/health",
  "GET",
  undefined,
  false,
  {
    timeout: 5000,
    retries: 1,
  }
);

// Heavy requests (30 seconds)
const heavyRequest = await apiRequest(
  "/api/v1/analytics",
  "GET",
  undefined,
  true,
  {
    timeout: 30000,
    retries: 2,
  }
);
```

### **Global Configuration**

Default settings can be modified in `networkUtils.ts`:

```typescript
export const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  timeout: 15000, // Increase default timeout
  retries: 5, // More retry attempts
  retryDelay: 2000, // Longer base delay
  retryBackoff: true, // Keep exponential backoff
};
```

## 🚀 **Deployment**

### **No Breaking Changes**

The implementation is backward compatible:

- Existing API calls work without modification
- New features are opt-in via configuration
- Default settings provide good balance

### **Gradual Rollout**

1. **Phase 1**: Deploy with default settings
2. **Phase 2**: Monitor timeout/retry metrics
3. **Phase 3**: Adjust settings based on data
4. **Phase 4**: Add more sophisticated retry logic

## 📈 **Monitoring**

### **Key Metrics**

Track these metrics to optimize the system:

- **Timeout Rate**: Percentage of requests that timeout
- **Retry Success Rate**: Percentage of retries that succeed
- **Average Request Time**: Time from start to completion
- **User Retry Rate**: How often users manually retry

### **Logging**

The system logs important events:

```typescript
console.log("Request timeout after 10s");
console.log("Retrying request (attempt 2/3)");
console.log("Request succeeded after 2 retries");
```

## 🎯 **Future Enhancements**

### **Planned Features**

1. **Adaptive Timeouts**: Adjust timeouts based on network conditions
2. **Offline Support**: Queue requests when offline
3. **Request Prioritization**: Prioritize critical requests
4. **Analytics Integration**: Track network performance metrics

### **Advanced Retry Strategies**

1. **Circuit Breaker**: Stop retrying if service is down
2. **Jitter**: Add randomness to retry delays
3. **Exponential Backoff with Cap**: Limit maximum delay
4. **Retry Budget**: Limit total retry time per request

---

This implementation ensures that users never miss content due to slow network connections, providing a robust and user-friendly experience across all network conditions.
