import AsyncStorage from '@react-native-async-storage/async-storage';
import { healthCheck } from './api';

// Simple API health tracking without overloading the API
export enum ApiHealthStatus {
  UNKNOWN = 'unknown',
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

interface ApiHealthState {
  status: ApiHealthStatus;
  lastCheck: number;
  consecutiveFailures: number;
}

// Storage keys
const API_HEALTH_KEY = 'PolkaMobile_apiHealth';
const API_FAILURE_COUNT_KEY = 'PolkaMobile_apiFailureCount';
const API_LAST_CHECK_KEY = 'PolkaMobile_apiLastCheck';

// Configuration - conservative to avoid overloading API
const HEALTH_CHECK_INTERVAL = 300000; // 5 minutes (much longer than before)
const MAX_CONSECUTIVE_FAILURES = 3;
const HEALTH_CHECK_TIMEOUT = 8000; // 8 seconds timeout

class ApiHealthChecker {
  private healthState: ApiHealthState = {
    status: ApiHealthStatus.UNKNOWN,
    lastCheck: 0,
    consecutiveFailures: 0
  };
  private listeners: ((state: ApiHealthState) => void)[] = [];
  private healthCheckTimeout: NodeJS.Timeout | null = null;
  private isChecking = false;

  constructor() {
    this.loadHealthState();
  }

  // Add listener for health state changes
  addListener(listener: (state: ApiHealthState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Emit health state to all listeners
  private emitHealthState() {
    this.listeners.forEach(listener => listener(this.healthState));
  }

  // Load health state from storage
  private async loadHealthState() {
    try {
      const [healthData, failureCount, lastCheck] = await Promise.all([
        AsyncStorage.getItem(API_HEALTH_KEY),
        AsyncStorage.getItem(API_FAILURE_COUNT_KEY),
        AsyncStorage.getItem(API_LAST_CHECK_KEY)
      ]);

      if (healthData) {
        this.healthState = JSON.parse(healthData);
      }
      
      if (failureCount) {
        this.healthState.consecutiveFailures = parseInt(failureCount, 10);
      }
      
      if (lastCheck) {
        this.healthState.lastCheck = parseInt(lastCheck, 10);
      }
    } catch (error) {
      console.error('Error loading API health state:', error);
    }
  }

  // Save health state to storage
  private async saveHealthState() {
    try {
      await Promise.all([
        AsyncStorage.setItem(API_HEALTH_KEY, JSON.stringify(this.healthState)),
        AsyncStorage.setItem(API_FAILURE_COUNT_KEY, this.healthState.consecutiveFailures.toString()),
        AsyncStorage.setItem(API_LAST_CHECK_KEY, this.healthState.lastCheck.toString())
      ]);
    } catch (error) {
      console.error('Error saving API health state:', error);
    }
  }

  // Perform health check - only when explicitly requested or after long intervals
  async checkApiHealth(): Promise<ApiHealthState> {
    if (this.isChecking) {
      return this.healthState;
    }

    // Don't check too frequently - respect the interval
    const now = Date.now();
    if (now - this.healthState.lastCheck < HEALTH_CHECK_INTERVAL) {
      return this.healthState;
    }

    this.isChecking = true;

    try {
      console.log('API Health Checker - Starting health check...');
      
      // Use timeout for health check
      const healthCheckPromise = healthCheck();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), HEALTH_CHECK_TIMEOUT);
      });

      await Promise.race([healthCheckPromise, timeoutPromise]);
      
      // Reset failure count on successful check
      this.healthState = {
        status: ApiHealthStatus.HEALTHY,
        lastCheck: now,
        consecutiveFailures: 0
      };

      console.log('API Health Checker - Health check successful');
      
    } catch (error) {
      const consecutiveFailures = this.healthState.consecutiveFailures + 1;
      
      let status = ApiHealthStatus.UNHEALTHY;
      if (consecutiveFailures < MAX_CONSECUTIVE_FAILURES) {
        status = ApiHealthStatus.DEGRADED;
      }

      this.healthState = {
        status,
        lastCheck: now,
        consecutiveFailures
      };

      console.error(`API Health Checker - Health check failed. Attempt ${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}. Error:`, error);
    } finally {
      this.isChecking = false;
      await this.saveHealthState();
      this.emitHealthState();
    }

    return this.healthState;
  }

  // Get current health state
  getHealthState(): ApiHealthState {
    return this.healthState;
  }

  // Check if API is healthy enough for normal operations
  isApiHealthy(): boolean {
    return this.healthState.status === ApiHealthStatus.HEALTHY;
  }

  // Check if API is degraded but still usable
  isApiDegraded(): boolean {
    return this.healthState.status === ApiHealthStatus.DEGRADED;
  }

  // Check if API is completely down
  isApiDown(): boolean {
    return this.healthState.status === ApiHealthStatus.UNHEALTHY;
  }

  // Start periodic health monitoring - but with much longer intervals
  startMonitoring() {
    if (this.healthCheckTimeout) {
      return; // Already monitoring
    }

    console.log('API Health Checker - Starting periodic monitoring (5 minute intervals)');
    
    // Perform initial health check
    this.checkApiHealth();
    
    // Set up periodic checks with long intervals
    this.healthCheckTimeout = setInterval(() => {
      this.checkApiHealth();
    }, HEALTH_CHECK_INTERVAL);
  }

  // Stop periodic health monitoring
  stopMonitoring() {
    if (this.healthCheckTimeout) {
      clearTimeout(this.healthCheckTimeout);
      this.healthCheckTimeout = null;
      console.log('API Health Checker - Stopped periodic monitoring');
    }
  }

  // Reset health state (useful for testing or after API recovery)
  async resetHealthState() {
    this.healthState = {
      status: ApiHealthStatus.UNKNOWN,
      lastCheck: 0,
      consecutiveFailures: 0
    };
    
    await this.saveHealthState();
    this.emitHealthState();
  }

  // Check if we should retry based on current health
  shouldRetryRequest(): boolean {
    return this.healthState.status !== ApiHealthStatus.UNHEALTHY;
  }

  // Get user-friendly error message based on health state
  getUserFriendlyMessage(): string {
    switch (this.healthState.status) {
      case ApiHealthStatus.HEALTHY:
        return 'API работает нормально';
      case ApiHealthStatus.DEGRADED:
        return 'API работает медленно. Попробуйте еще раз.';
      case ApiHealthStatus.UNHEALTHY:
        return 'API временно недоступен. Попробуйте позже.';
      default:
        return 'Проверка состояния API...';
    }
  }
}

// Create singleton instance
export const apiHealthChecker = new ApiHealthChecker();

// Auto-start monitoring when imported (but with long intervals)
// Commented out to prevent interference with normal API calls
// apiHealthChecker.startMonitoring();
