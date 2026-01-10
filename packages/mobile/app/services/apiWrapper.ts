import { apiErrorHandler, withApiErrorHandling, ApiCallContext } from './apiErrorHandler';
import { apiHealthChecker } from './apiHealthCheck';
import * as api from './api';

/**
 * Wrapper for API calls with intelligent error handling
 * Builds upon existing networkUtils and apiErrorHandler
 */
export class ApiWrapper {
  private static instance: ApiWrapper;
  
  static getInstance(): ApiWrapper {
    if (!ApiWrapper.instance) {
      ApiWrapper.instance = new ApiWrapper();
    }
    return ApiWrapper.instance;
  }

  /**
   * Wrap API call with error handling and health checking
   */
  async call<T>(
    apiCall: () => Promise<T>,
    context: ApiCallContext,
    retryFn?: () => Promise<T>
  ): Promise<T | null> {
    // Use the existing error handling system directly
    // Health checking can be enabled later if needed
    return withApiErrorHandling(apiCall, context, retryFn);
  }

  // Main page API calls
  async getUserRecommendations(pageName: string = 'MainPage'): Promise<api.Product[] | null> {
    return this.call(
      () => api.getUserRecommendations(),
      {
        pageName,
        operation: 'getUserRecommendations',
        isCritical: true,
        hasFallback: false
      },
      () => this.getUserRecommendations(pageName)
    );
  }

  async getCurrentUser(pageName: string = 'MainPage'): Promise<api.UserProfile | null> {
    return this.call(
      () => api.getCurrentUser(),
      {
        pageName,
        operation: 'getCurrentUser',
        isCritical: true,
        hasFallback: false
      },
      () => this.getCurrentUser(pageName)
    );
  }

  // Search page API calls
  async getProductSearchResults(
    params: any,
    pageName: string = 'SearchPage'
  ): Promise<api.Product[] | null> {
    return this.call(
      () => api.getProductSearchResults(params),
      {
        pageName,
        operation: 'getProductSearchResults',
        isCritical: false, // Search can work with empty results
        hasFallback: true
      },
      () => this.getProductSearchResults(params, pageName)
    );
  }

  async getPopularItems(
    limit: number = 8,
    pageName: string = 'SearchPage'
  ): Promise<api.Product[] | null> {
    return this.call(
      () => api.getPopularItems(limit),
      {
        pageName,
        operation: 'getPopularItems',
        isCritical: false, // Can work without popular items
        hasFallback: true
      },
      () => this.getPopularItems(limit, pageName)
    );
  }

  async getBrands(pageName: string = 'SearchPage'): Promise<api.Brand[] | null> {
    return this.call(
      () => api.getBrands(),
      {
        pageName,
        operation: 'getBrands',
        isCritical: false, // Can work without brands
        hasFallback: true
      },
      () => this.getBrands(pageName)
    );
  }

  async getStyles(pageName: string = 'SearchPage'): Promise<api.Style[] | null> {
    return this.call(
      () => api.getStyles(),
      {
        pageName,
        operation: 'getStyles',
        isCritical: false, // Can work without styles
        hasFallback: true
      },
      () => this.getStyles(pageName)
    );
  }

  async getCategories(pageName: string = 'SearchPage'): Promise<any[] | null> {
    return this.call(
      () => api.getCategories(),
      {
        pageName,
        operation: 'getCategories',
        isCritical: false, // Can work without categories
        hasFallback: true
      },
      () => this.getCategories(pageName)
    );
  }

  // Favorites page API calls
  async getFriends(pageName: string = 'FavoritesPage'): Promise<api.Friend[] | null> {
    return this.call(
      () => api.getFriends(),
      {
        pageName,
        operation: 'getFriends',
        isCritical: false, // Can work without friends list
        hasFallback: true
      },
      () => this.getFriends(pageName)
    );
  }

  async getSentFriendRequests(pageName: string = 'FavoritesPage'): Promise<api.FriendRequest[] | null> {
    return this.call(
      () => api.getSentFriendRequests(),
      {
        pageName,
        operation: 'getSentFriendRequests',
        isCritical: false,
        hasFallback: true
      },
      () => this.getSentFriendRequests(pageName)
    );
  }

  async getReceivedFriendRequests(pageName: string = 'FavoritesPage'): Promise<api.FriendRequest[] | null> {
    return this.call(
      () => api.getReceivedFriendRequests(),
      {
        pageName,
        operation: 'getReceivedFriendRequests',
        isCritical: false,
        hasFallback: true
      },
      () => this.getReceivedFriendRequests(pageName)
    );
  }

  async getUserFavorites(pageName: string = 'FavoritesPage'): Promise<api.Product[] | null> {
    return this.call(
      () => api.getUserFavorites(),
      {
        pageName,
        operation: 'getUserFavorites',
        isCritical: false, // Can work without favorites
        hasFallback: true
      },
      () => this.getUserFavorites(pageName)
    );
  }

  async getFriendRecommendations(
    friendId: string,
    pageName: string = 'FavoritesPage'
  ): Promise<api.Product[] | null> {
    return this.call(
      () => api.getFriendRecommendations(friendId),
      {
        pageName,
        operation: 'getFriendRecommendations',
        isCritical: false,
        hasFallback: true
      },
      () => this.getFriendRecommendations(friendId, pageName)
    );
  }

  // Settings page API calls
  async getUserStats(pageName: string = 'SettingsPage'): Promise<api.UserStats | null> {
    return this.call(
      () => api.getUserStats(),
      {
        pageName,
        operation: 'getUserStats',
        isCritical: false, // Can work without stats
        hasFallback: true
      },
      () => this.getUserStats(pageName)
    );
  }

  // Generic wrapper for any API call
  async wrapApiCall<T>(
    apiCall: () => Promise<T>,
    pageName: string,
    operation: string,
    isCritical: boolean = false,
    hasFallback: boolean = true
  ): Promise<T | null> {
    return this.call(
      apiCall,
      {
        pageName,
        operation,
        isCritical,
        hasFallback
      },
      () => this.wrapApiCall(apiCall, pageName, operation, isCritical, hasFallback)
    );
  }
}

// Export singleton instance
export const apiWrapper = ApiWrapper.getInstance();

// Export convenience functions
export const {
  getUserRecommendations,
  getCurrentUser,
  getProductSearchResults,
  getPopularItems,
  getBrands,
  getStyles,
  getCategories,
  getFriends,
  getSentFriendRequests,
  getReceivedFriendRequests,
  getUserFavorites,
  getFriendRecommendations,
  getUserStats,
  wrapApiCall
} = apiWrapper;
