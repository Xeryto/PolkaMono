import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  Dimensions,
  Platform,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
  FadeOutUp,
} from "react-native-reanimated";
import { AntDesign } from "@expo/vector-icons";
import * as api from "./services/api";
import { apiWrapper } from "./services/apiWrapper";

import { ImageSourcePropType } from "react-native";
import { CardItem, ProductVariant } from "./types/product";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "./lib/animations";
import { mapProductToCardItem } from "./lib/productMapper";
import { useTheme } from "./lib/ThemeContext";
import type { ThemeColors } from "./lib/theme";

// Create animated text component using proper method for this version
const AnimatedText = Animated.createAnimatedComponent(Text);

const { width, height } = Dimensions.get("window");

// Price tag component with dynamic sizing using the article's approach
const PriceTag = ({ price }: { price: number }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [textWidth, setTextWidth] = useState(0);
  const [textHeight, setTextHeight] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);

  const handleTextLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    if (
      width > 0 &&
      height > 0 &&
      (!isMeasured || width !== textWidth || height !== textHeight)
    ) {
      setTextWidth(width);
      setTextHeight(height);
      setIsMeasured(true);
    }
  };

  const TEXT_LENGTH = isMeasured ? textWidth : 70;
  const TEXT_HEIGHT = isMeasured ? textHeight : 22;
  const OFFSET = isMeasured ? TEXT_LENGTH / 2 - TEXT_HEIGHT / 2 : 0;

  const translateX = isMeasured ? TEXT_LENGTH * 0.3 : 200;
  const translateY = isMeasured ? TEXT_HEIGHT * 2.35 : 0;

  return (
    <View
      style={[
        styles.priceContainer,
        {
          position: "absolute",
          right: 0,
          top: 0,
          width: isMeasured ? TEXT_HEIGHT : 200,
          height: isMeasured ? TEXT_LENGTH : 100,
          transform: [{ translateX: translateX }, { translateY: translateY }],
          overflow: "visible",
        },
      ]}
    >
      {!isMeasured && (
        <Text onLayout={handleTextLayout} style={styles.itemPrice}>
          {`${price.toFixed(2)} ₽`}
        </Text>
      )}
      {isMeasured && (
        <Text
          style={[
            styles.itemPrice,
            {
              width: TEXT_LENGTH,
              height: TEXT_HEIGHT,
              overflow: "visible",
              transform: [
                { rotate: "90deg" },
                { translateX: -OFFSET },
                { translateY: OFFSET },
              ],
            },
          ]}
        >
          {`${price.toFixed(2)} ₽`}
        </Text>
      )}
    </View>
  );
};

// Define a simpler navigation type that our custom navigation can satisfy
interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  setParams?: (params: any) => void;
}

interface SearchProps {
  navigation: SimpleNavigation;
}

// Using unified CardItem from types/product.d.ts
type SearchItem = CardItem;

interface FilterOptions {
  category: string[];
  brand: string[];
  style: string[];
}

const FILTER_LABELS = {
  category: "категория",
  brand: "бренд",
  style: "стиль",
} as const;

interface SelectedFilters {
  category: string[];
  brand: string[];
  style: string[];
}

// Minimum search query length before sending API request
const MIN_SEARCH_LENGTH = 2;

// Replace simulated API with real product search
const fetchMoreSearchResults = async (
  query: string = "",
  filters: SelectedFilters = {
    category: [],
    brand: [],
    style: [],
  },
  count: number = 16,
  offset: number = 0,
): Promise<SearchItem[]> => {
  try {
    // Trim query and check if it's blank or all spaces
    const trimmedQuery = query.trim();
    const hasValidQuery = trimmedQuery.length >= MIN_SEARCH_LENGTH;

    // Check if any filter is actively selected (has any selected options)
    const hasActiveFilters =
      filters.category.length > 0 ||
      filters.brand.length > 0 ||
      filters.style.length > 0;

    // Don't make API call if query is too short and no active filters
    if (!hasValidQuery && !hasActiveFilters) {
      console.log(
        `Search - Skipping API call: query too short (${trimmedQuery.length} chars, need ${MIN_SEARCH_LENGTH}) and no active filters`,
      );
      return [];
    }

    const params: any = {
      limit: count,
      offset,
    };
    // Only add query parameter if it meets minimum length requirement
    if (hasValidQuery) {
      params.query = trimmedQuery;
    }
    if (filters.category.length > 0) params.categories = filters.category;
    if (filters.brand.length > 0) params.brands = filters.brand;
    if (filters.style.length > 0) params.styles = filters.style;

    const results = await apiWrapper.getProductSearchResults(
      params,
      "SearchPage",
    );
    if (!results) return [];

    // Deduplicate by product ID (defensive measure in case API returns duplicates)
    // Use a Map to preserve order while removing duplicates (last occurrence wins)
    const seenIds = new Map<string, api.Product>();
    for (const item of results) {
      seenIds.set(item.id, item);
    }
    const uniqueResults = Array.from(seenIds.values());

    // Use utility function to ensure consistent mapping with article_number preservation
    return uniqueResults.map((item: api.Product, index: number) =>
      mapProductToCardItem(item, index),
    );
  } catch (error) {
    console.error("Error fetching product search results:", error);
    return [];
  }
};

// Persistent storage for search results that survives component unmounts
const persistentSearchStorage: {
  results: SearchItem[];
  initialized: boolean;
} = {
  results: [],
  initialized: false,
};

const Search = ({ navigation }: SearchProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState<keyof FilterOptions | null>(
    null
  );
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    category: [],
    brand: [],
    style: [],
  });

  // Initialize searchResults with persistent storage or default items
  const [searchResults, setSearchResults] = useState<SearchItem[]>(() => {
    // If we already have results in our persistent storage, use those
    if (persistentSearchStorage.initialized) {
      console.log(
        "Search - Using persistent results:",
        persistentSearchStorage.results,
      );
      return persistentSearchStorage.results;
    }

    // Otherwise initialize with an empty array, will be populated with popular items on mount
    persistentSearchStorage.results = [];
    persistentSearchStorage.initialized = true;
    console.log(
      "Search - Initialized persistent results storage with empty array",
    );

    return [];
  });

  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    category: [],
    brand: [],
    style: [],
  });
  const [isLoadingFilters, setIsLoadingFilters] = useState(true);
  const [isLoadingResults, setIsLoadingResults] = useState(false);

  // Pagination state for search results
  const [searchOffset, setSearchOffset] = useState<number>(0);
  const [hasMoreResults, setHasMoreResults] = useState<boolean>(false);
  const [isLoadingMoreResults, setIsLoadingMoreResults] =
    useState<boolean>(false);
  const PAGE_SIZE = 16; // Number of results per page

  // Track previous filter values to detect filter-only changes
  const prevFiltersRef = useRef<SelectedFilters>(selectedFilters);
  const prevSearchQueryRef = useRef<string>(searchQuery);
  // Track request ID to prevent stale results from overwriting newer ones
  const requestIdRef = useRef<number>(0);
  // Track if we're currently loading more to prevent multiple simultaneous calls
  const isLoadingMoreRef = useRef<boolean>(false);

  useEffect(() => {
    const loadFilters = async () => {
      setIsLoadingFilters(true);
      try {
        const [brands, styles, categories] = await Promise.all([
          apiWrapper.getBrands("SearchPage"),
          apiWrapper.getStyles("SearchPage"),
          apiWrapper.getCategories("SearchPage"),
        ]);
        setFilterOptions({
          brand: brands?.map((b: any) => b.name) || [],
          style: styles?.map((s: any) => s.name) || [],
          category: categories?.map((c: any) => c.id) || [], // API filters by category_id
        });
      } catch (error) {
        console.error("Error loading filter options:", error);
        setFilterOptions({ category: [], brand: [], style: [] });
      } finally {
        setIsLoadingFilters(false);
      }
    };
    loadFilters();
  }, []);

  // Helper function to load and map popular items - wrapped in useCallback to prevent recreation on every render
  const loadPopularItems = useCallback(async () => {
    const myRequestId = ++requestIdRef.current;
    console.log("Search - Loading popular items");
    setIsLoadingResults(true);
    try {
      const popularItems = await apiWrapper.getPopularItems(16, "SearchPage");
      if (myRequestId !== requestIdRef.current) return;
      if (popularItems && popularItems.length > 0) {
        // Deduplicate by product ID (defensive measure)
        const seenIds = new Map<string, api.Product>();
        for (const item of popularItems) {
          seenIds.set(item.id, item);
        }
        const uniquePopularItems = Array.from(seenIds.values());

        // Use utility function to ensure consistent mapping with article_number preservation
        const mappedItems: SearchItem[] = uniquePopularItems.map(
          (item: api.Product, index: number) =>
            mapProductToCardItem(item, index),
        );
        setSearchResults(mappedItems);
        persistentSearchStorage.results = mappedItems;
        console.log(
          "Search - Loaded popular items:",
          mappedItems.length,
          `(deduplicated from ${popularItems.length})`,
        );
      } else {
        // No popular items found, keep results empty
        setSearchResults([]);
        persistentSearchStorage.results = [];
      }
    } catch (error) {
      if (myRequestId !== requestIdRef.current) return;
      console.error("Error loading popular items:", error);
      // On error, keep results empty
      setSearchResults([]);
      persistentSearchStorage.results = [];
    } finally {
      if (myRequestId === requestIdRef.current) {
        setIsLoadingResults(false);
      }
    }
  }, []); // Empty deps - function doesn't depend on any props/state

  // Track previous isSearchActive to detect when exiting search mode
  const prevIsSearchActiveRef = useRef<boolean>(isSearchActive);
  const popularItemsLoadedRef = useRef<boolean>(false);
  const isInitialMountRef = useRef<boolean>(true);
  const searchQueryRef = useRef<string>(searchQuery);
  const selectedFiltersRef = useRef<SelectedFilters>(selectedFilters);
  const searchResultsLengthRef = useRef<number>(searchResults.length);

  // Update refs when values change (used for checking without causing re-renders)
  useEffect(() => {
    searchQueryRef.current = searchQuery;
    selectedFiltersRef.current = selectedFilters;
    searchResultsLengthRef.current = searchResults.length;
  }, [searchQuery, selectedFilters, searchResults]);

  // Load popular items when component mounts or when exiting search mode
  useEffect(() => {
    // Use refs to check values without triggering re-runs on every change
    const trimmedQuery = searchQueryRef.current.trim();
    const hasValidQuery = trimmedQuery.length >= MIN_SEARCH_LENGTH;
    const hasActiveFilters =
      selectedFiltersRef.current.category.length > 0 ||
      selectedFiltersRef.current.brand.length > 0 ||
      selectedFiltersRef.current.style.length > 0;

    // Check if we're exiting search mode (was active, now not active)
    const wasSearchActive = prevIsSearchActiveRef.current;
    const exitingSearchMode = wasSearchActive && !isSearchActive;
    const isInitialMount = isInitialMountRef.current;

    if (isInitialMount) {
      isInitialMountRef.current = false;
      prevIsSearchActiveRef.current = isSearchActive;
    } else {
      prevIsSearchActiveRef.current = isSearchActive;
    }

    // Only load popular items if:
    // 1. Search is not active
    // 2. No active query or filters
    if (!isSearchActive && !hasValidQuery && !hasActiveFilters) {
      // If exiting search mode, clear search results and reset pagination
      if (exitingSearchMode) {
        console.log(
          "Search - Exiting search mode, clearing results and resetting pagination",
        );
        setSearchResults([]);
        persistentSearchStorage.results = [];
        setSearchOffset(0);
        setHasMoreResults(false);
        setIsLoadingMoreResults(false);
        isLoadingMoreRef.current = false; // Reset ref
        popularItemsLoadedRef.current = false;
        searchResultsLengthRef.current = 0;
      }

      // Load popular items if:
      // - Initial mount and no results, OR
      // - Exiting search mode (already cleared above), OR
      // - We haven't loaded them yet
      const shouldLoad =
        (isInitialMount && searchResultsLengthRef.current === 0) ||
        exitingSearchMode ||
        !popularItemsLoadedRef.current;

      if (shouldLoad) {
        console.log(
          `Search - Loading popular items (initial: ${isInitialMount}, exiting: ${exitingSearchMode})`,
        );
        // Reset pagination when loading popular items (popular items don't use pagination)
        setSearchOffset(0);
        setHasMoreResults(false);
        setIsLoadingMoreResults(false);
        isLoadingMoreRef.current = false;

        loadPopularItems()
          .then(() => {
            popularItemsLoadedRef.current = true;
          })
          .catch(() => {
            popularItemsLoadedRef.current = false; // Reset on error so it can retry
          });
      }
    } else if (isSearchActive) {
      // Reset flag when entering search mode so popular items can be reloaded when exiting
      popularItemsLoadedRef.current = false;
    }
  }, [isSearchActive, loadPopularItems]); // Only depend on isSearchActive and loadPopularItems (which is memoized)

  const handleSearch = (text: string) => {
    setSearchQuery(text);
  };

  const handleSearchFocus = () => {
    setIsSearchActive(true);
  };

  const handleFilterPress = (filterType: keyof FilterOptions) => {
    setActiveFilter(activeFilter === filterType ? null : filterType);
  };

  const handleOptionSelect = (
    filterType: keyof FilterOptions,
    option: string,
  ) => {
    setSelectedFilters((prev) => {
      const current = prev[filterType];
      const isSelected = current.includes(option);
      return {
        ...prev,
        [filterType]: isSelected
          ? current.filter((v) => v !== option)
          : [...current, option],
      };
    });
  };

  const isFilterSelected = (filterType: keyof SelectedFilters): boolean =>
    selectedFilters[filterType].length > 0;

  const isOptionSelected = (
    filterType: keyof SelectedFilters,
    option: string,
  ): boolean => selectedFilters[filterType].includes(option);

  // Handle item selection and removal
  const handleItemPress = (item: SearchItem, index: number) => {
    // Create params to pass the selected item to MainPage first
    // This ensures we have the item data before removing it
    // Spread the entire item to preserve all fields including article_number
    const params = {
      addCardItem: {
        ...item, // Spread all fields to preserve article_number and other optional fields
      } as CardItem,
    };

    console.log("Search - Navigating to Home with item:", params);

    // Remove the selected item from the array
    setSearchResults((prevResults) => {
      const newResults = [...prevResults];
      // Remove the selected item
      newResults.splice(index, 1);

      // Log info
      console.log(
        "Search - Item removed, remaining results:",
        newResults.length,
      );

      // Check if we need to fetch more results
      if (newResults.length < 4) {
        console.log("Search - Low on results, fetching more from API");
        // Fetch new items in a separate call to avoid state update issues
        setTimeout(() => {
          fetchMoreSearchResults(searchQuery, selectedFilters, 2).then(
            (apiResults) => {
              setSearchResults((latestResults) => {
                const updatedResults = [...latestResults, ...apiResults];
                console.log(
                  "Search - Added new results, total count:",
                  updatedResults.length,
                );

                // Update persistent storage
                persistentSearchStorage.results = updatedResults;
                return updatedResults;
              });
            },
          );
        }, 0);
      } else {
        // Always update persistent storage
        persistentSearchStorage.results = newResults;
      }

      return newResults;
    });

    // Navigate to Home screen with the selected item as a parameter
    // Do this after starting the state update but don't wait for it to complete
    navigation.navigate("Home", params);
  };

  // Update the filter function to check both name and query
  const trimmedQuery = searchQuery.trim();
  const hasValidQuery = trimmedQuery.length >= MIN_SEARCH_LENGTH;
  const hasActiveQuery = trimmedQuery.length > 0;
  const hasActiveFilters =
    selectedFilters.category.length > 0 ||
    selectedFilters.brand.length > 0 ||
    selectedFilters.style.length > 0;

  // The API already filters results by query (including article_number), so we don't need client-side filtering
  // Use searchResults directly as filteredResults since the API handles all filtering
  const filteredResults = searchResults;

  // Check if we should show the empty state
  // Show empty state when:
  // 1. NOT in search mode and no results (shows popular items placeholder)
  // 2. IN search mode with no query/filters (shows "start search" message)
  const showEmptyState =
    !hasValidQuery &&
    !hasActiveFilters &&
    !isLoadingResults &&
    filteredResults.length === 0;
  // Check if there are no results but there was a valid query/filter (only when not loading)
  const showNoResults =
    !isLoadingResults &&
    (hasValidQuery || hasActiveFilters) &&
    filteredResults.length === 0;

  // Debug: Log display conditions when we have results but they might not be showing
  useEffect(() => {
    if (searchResults.length > 0 || isLoadingResults) {
      console.log(
        `Search - Display state: searchResults=${searchResults.length}, filteredResults=${filteredResults.length}, isLoadingResults=${isLoadingResults}, showEmptyState=${showEmptyState}, showNoResults=${showNoResults}, isSearchActive=${isSearchActive}, query="${trimmedQuery}"`,
      );
    }
  }, [
    searchResults.length,
    filteredResults.length,
    isLoadingResults,
    showEmptyState,
    showNoResults,
    isSearchActive,
    trimmedQuery,
  ]);

  // Update persistent storage whenever searchResults change
  useEffect(() => {
    persistentSearchStorage.results = searchResults;
    console.log(
      "Search - Updated persistent storage with results:",
      searchResults,
    );
  }, [searchResults]);

  // Track previous isSearchActive in search effect to detect mode transitions
  const prevSearchActiveInEffectRef = useRef<boolean>(isSearchActive);

  // Fetch new results when search query or filters change
  useEffect(() => {
    // Check if we're entering search mode (was not active, now active)
    const wasSearchActive = prevSearchActiveInEffectRef.current;
    const enteringSearchMode = !wasSearchActive && isSearchActive;

    // Only fetch if the search is active (user has clicked in the search field)
    if (isSearchActive) {
      // If we're entering search mode, clear popular items immediately to show empty search state
      if (enteringSearchMode) {
        console.log(
          "Search - Entering search mode, clearing popular items and showing empty search state",
        );
        setSearchResults([]);
        persistentSearchStorage.results = [];
        setSearchOffset(0);
        setHasMoreResults(false);
        setIsLoadingMoreResults(false);
        isLoadingMoreRef.current = false; // Reset ref
        setIsLoadingResults(false); // Show empty state, not loading
        // Update refs
        prevFiltersRef.current = selectedFilters;
        prevSearchQueryRef.current = searchQuery;
        // Update the search active ref AFTER clearing
        prevSearchActiveInEffectRef.current = isSearchActive;
        return; // Exit early - don't fetch anything yet
      }

      // Trim and check if query is blank or all spaces
      const trimmedQuery = searchQuery.trim();
      const hasValidQuery = trimmedQuery.length >= MIN_SEARCH_LENGTH;
      const hasActiveQuery = trimmedQuery.length > 0;

      // Check if any filter is actively selected (not default)
      const hasActiveFilters =
        selectedFilters.category.length > 0 ||
        selectedFilters.brand.length > 0 ||
        selectedFilters.style.length > 0;

      const arraysEqual = (a: string[], b: string[]) =>
        a.length === b.length && a.every((v, i) => v === b[i]);
      const filtersChanged =
        !arraysEqual(
          prevFiltersRef.current.category,
          selectedFilters.category,
        ) ||
        !arraysEqual(prevFiltersRef.current.brand, selectedFilters.brand) ||
        !arraysEqual(prevFiltersRef.current.style, selectedFilters.style);

      const searchQueryChanged = prevSearchQueryRef.current !== searchQuery;

      // Only send query if there's a valid search term (min length) or active filters
      // Check this FIRST before setting loading state
      if (!hasValidQuery && !hasActiveFilters) {
        // Query too short (including spaces-only) or no active filters - clear results to show empty search state
        // When in search mode, we always want to show the "start search" message, not popular items
        setSearchResults([]);
        persistentSearchStorage.results = [];
        setSearchOffset(0);
        setHasMoreResults(false);
        setIsLoadingMoreResults(false);
        setIsLoadingResults(false); // Not loading since we're skipping the API call
        // Update refs even if we skip the API call
        prevFiltersRef.current = selectedFilters;
        prevSearchQueryRef.current = searchQuery;
        console.log(
          "Search - No valid query (including spaces-only) or filters, showing empty search state",
        );
        return;
      }

      // If filters changed, clear results immediately to prevent stacking and show loading
      // BUT only if we have active filters, not if filters were just reset
      if (filtersChanged && hasActiveFilters) {
        setSearchResults([]);
        persistentSearchStorage.results = [];
        setSearchOffset(0);
        setHasMoreResults(false);
        setIsLoadingMoreResults(false);
        isLoadingMoreRef.current = false; // Reset ref
        setIsLoadingResults(true); // Show loading spinner immediately when filters change
        console.log(
          "Search - Filters changed, clearing previous results and resetting pagination",
        );
      }

      // For valid queries/filters, show loading state immediately during debounce period
      // This prevents the "nothing found" flash before loading spinner appears
      // Only set loading if we have a valid query OR active filters (already checked above)
      setIsLoadingResults(true);
      // Clear previous results while debouncing to avoid showing stale results
      if (searchQueryChanged) {
        setSearchResults([]);
        persistentSearchStorage.results = [];
      }

      // Debounce filter changes so selecting multiple options quickly doesn't trigger many requests
      const debounceDelay = filtersChanged && !searchQueryChanged ? 400 : 800;

      // Add a delay to avoid fetching on every keystroke (or immediate for filter changes)
      const timer = setTimeout(() => {
        // Re-check if query is still valid after debounce delay
        const currentTrimmedQuery = searchQuery.trim();
        const currentHasValidQuery =
          currentTrimmedQuery.length >= MIN_SEARCH_LENGTH;

        // Re-check if filters changed (capture at timeout execution time)
        const arraysEqualAtTimeout = (a: string[], b: string[]) =>
          a.length === b.length && a.every((v, i) => v === b[i]);
        const filtersChangedAtTimeout =
          !arraysEqualAtTimeout(
            prevFiltersRef.current.category,
            selectedFilters.category,
          ) ||
          !arraysEqualAtTimeout(
            prevFiltersRef.current.brand,
            selectedFilters.brand,
          ) ||
          !arraysEqualAtTimeout(
            prevFiltersRef.current.style,
            selectedFilters.style,
          );

        const currentHasActiveFilters =
          selectedFilters.category.length > 0 ||
          selectedFilters.brand.length > 0 ||
          selectedFilters.style.length > 0;

        if (!currentHasValidQuery && !currentHasActiveFilters) {
          // Query is too short or empty - clear results and show empty search state
          // When in search mode, we always show empty state when there's no query/filters
          setSearchResults([]);
          persistentSearchStorage.results = [];
          setIsLoadingResults(false); // Not loading since we're skipping
          // Update refs before returning
          prevFiltersRef.current = selectedFilters;
          prevSearchQueryRef.current = searchQuery;
          console.log(
            "Search - No valid query or filters after debounce, showing empty search state",
          );
          return;
        }

        // Increment request ID for this new request
        const currentRequestId = ++requestIdRef.current;

        // Reset pagination for new search (query or filters changed)
        setSearchOffset(0);
        setHasMoreResults(true);
        setIsLoadingMoreResults(false);

        // Loading state is already set above, no need to set it again here

        console.log(
          "Search - Query or filters changed, fetching first page of results",
        );
        fetchMoreSearchResults(
          currentHasValidQuery ? currentTrimmedQuery : "", // Only send query if it meets minimum length
          selectedFilters,
          PAGE_SIZE,
          0, // Start from offset 0 for new search
        )
          .then((apiResults) => {
            console.log(
              `Search - Promise resolved with ${
                apiResults?.length || 0
              } results for query "${currentTrimmedQuery}"`,
            );
            // Only update results if this is still the latest request (prevents stale results from overwriting newer ones)
            if (currentRequestId === requestIdRef.current) {
              // Ensure apiResults is an array (defensive check)
              const results = Array.isArray(apiResults) ? apiResults : [];

              // Replace results with new API results since this is a new search query/filter combination
              console.log(
                `Search - Setting ${results.length} results. First result:`,
                results[0]
                  ? {
                      id: results[0].id,
                      name: results[0].name,
                      article_number: results[0].article_number,
                    }
                  : "none",
              );

              // CRITICAL: Set loading to false BEFORE setting results to ensure UI updates correctly
              setIsLoadingResults(false);

              // Reset initial count ref for new search (new items will all be animated)
              initialResultsCountRef.current = 0;

              // Now set the results
              setSearchResults(results);

              // Update persistent storage
              persistentSearchStorage.results = results;

              // Check if there are more results (if we got a full page, there might be more)
              setHasMoreResults(results.length >= PAGE_SIZE);

              // Update offset for next page
              setSearchOffset(results.length);

              console.log(
                `Search - ${
                  filtersChangedAtTimeout ? "Filters changed" : "Query changed"
                }, loaded first page. Count: ${results.length}, hasMore: ${
                  results.length >= PAGE_SIZE
                }, query: "${currentTrimmedQuery}", isLoadingResults: false, will display: ${
                  results.length > 0
                }`,
              );

              // Update refs after successfully updating results
              prevFiltersRef.current = selectedFilters;
              prevSearchQueryRef.current = searchQuery;
            } else {
              console.log(
                `Search - Ignoring stale results (request ${currentRequestId} is not the latest ${requestIdRef.current})`,
              );
              // Still set loading to false even for stale requests to prevent UI lock
              setIsLoadingResults(false);
            }
          })
          .catch((error) => {
            // Only update state if this is still the latest request
            if (currentRequestId === requestIdRef.current) {
              setIsLoadingResults(false); // Hide loading spinner on error
              setHasMoreResults(false); // No more results on error
              setSearchOffset(0);
              prevFiltersRef.current = selectedFilters;
              prevSearchQueryRef.current = searchQuery;
            } else {
              console.log(
                `Search - Ignoring error from stale request (request ${currentRequestId} is not the latest ${requestIdRef.current})`,
              );
            }
            // Don't re-throw - let the error be handled silently for stale requests
            // The error is already logged by the apiWrapper
          });
      }, debounceDelay);

      return () => clearTimeout(timer);
    } else {
      // Update refs even when search is not active
      prevFiltersRef.current = selectedFilters;
      prevSearchQueryRef.current = searchQuery;
    }

    // Always update the search active ref at the end (after all checks)
    prevSearchActiveInEffectRef.current = isSearchActive;
  }, [searchQuery, selectedFilters, isSearchActive]);

  // Load more search results (append next page) - called when user scrolls to bottom
  const loadMoreSearchResults = useCallback(async () => {
    // Don't load if already loading, no more results, or not in search mode
    // Use ref to prevent multiple simultaneous calls
    if (
      isLoadingMoreRef.current ||
      isLoadingMoreResults ||
      !hasMoreResults ||
      !isSearchActive
    ) {
      return;
    }

    isLoadingMoreRef.current = true;

    // Don't load if there's no valid query or filters
    const trimmedQuery = searchQuery.trim();
    const hasValidQuery = trimmedQuery.length >= MIN_SEARCH_LENGTH;
    const hasActiveFilters =
      selectedFilters.category.length > 0 ||
      selectedFilters.brand.length > 0 ||
      selectedFilters.style.length > 0;

    if (!hasValidQuery && !hasActiveFilters) {
      return;
    }

    setIsLoadingMoreResults(true);
    const currentOffset = searchOffset; // Capture current offset
    console.log(`Search - Loading more results, offset: ${currentOffset}`);

    try {
      const nextPageResults = await fetchMoreSearchResults(
        hasValidQuery ? trimmedQuery : "",
        selectedFilters,
        PAGE_SIZE,
        currentOffset,
      );

      if (nextPageResults && nextPageResults.length > 0) {
        // Use functional update to append results without needing searchResults in dependencies
        setSearchResults((prevResults) => {
          // Deduplicate against existing results (defensive measure)
          const existingIds = new Set(prevResults.map((item) => item.id));
          const newUniqueResults = nextPageResults.filter(
            (item) => !existingIds.has(item.id),
          );

          if (newUniqueResults.length > 0) {
            // Append new results to existing ones
            const updatedResults = [...prevResults, ...newUniqueResults];
            persistentSearchStorage.results = updatedResults;

            // Check if there are more results (if we got a full page, there might be more)
            setHasMoreResults(nextPageResults.length >= PAGE_SIZE);
            // Update offset for next page
            setSearchOffset((prev) => prev + newUniqueResults.length);

            console.log(
              `Search - Loaded ${
                newUniqueResults.length
              } more results (deduplicated from ${
                nextPageResults.length
              }). Total: ${updatedResults.length}, hasMore: ${
                nextPageResults.length >= PAGE_SIZE
              }`,
            );
            return updatedResults;
          } else {
            // All results were duplicates, no more unique results
            setHasMoreResults(false);
            console.log(
              "Search - All next page results were duplicates, no more results",
            );
            return prevResults; // Return existing results unchanged
          }
        });
      } else {
        // No more results
        setHasMoreResults(false);
        console.log("Search - No more results available");
      }
    } catch (error) {
      console.error("Search - Error loading more results:", error);
      setHasMoreResults(false); // Stop trying on error
    } finally {
      setIsLoadingMoreResults(false);
      isLoadingMoreRef.current = false; // Reset ref
    }
  }, [
    isLoadingMoreResults,
    hasMoreResults,
    isSearchActive,
    searchQuery,
    selectedFilters,
    searchOffset,
  ]); // Removed searchResults from deps

  // Handle cancel search
  const handleCancelSearch = () => {
    // Reset search query
    setSearchQuery("");

    // Reset any active filters
    setActiveFilter(null);
    setSelectedFilters({
      category: [],
      brand: [],
      style: [],
    });

    // Clear search results and reset pagination
    setSearchResults([]);
    persistentSearchStorage.results = [];
    setSearchOffset(0);
    setHasMoreResults(false);
    setIsLoadingMoreResults(false);
    isLoadingMoreRef.current = false; // Reset ref

    // Dismiss the keyboard if it's open
    Keyboard.dismiss();

    // Exit search mode with animation
    // The useEffect watching isSearchActive will load popular items when it becomes false
    setIsSearchActive(false);
  };

  // Track the initial result count to only animate newly added items
  const initialResultsCountRef = useRef<number>(0);

  useEffect(() => {
    // Update initial count when search results are first loaded or reset
    if (searchResults.length > 0 && initialResultsCountRef.current === 0) {
      initialResultsCountRef.current = searchResults.length;
    } else if (searchResults.length === 0) {
      // Reset when results are cleared
      initialResultsCountRef.current = 0;
    }
  }, [searchResults.length]);

  // Memoize renderItem to prevent unnecessary re-renders
  const renderItem = useCallback(
    ({ item, index }: { item: SearchItem; index: number }) => {
      // Only animate items that are newly added (beyond initial count)
      const isNewItem = index >= initialResultsCountRef.current;

      return (
        <Animated.View
          entering={
            isNewItem
              ? FadeInDown.duration(ANIMATION_DURATIONS.STANDARD).delay(
                  ANIMATION_DELAYS.STANDARD +
                    (index - initialResultsCountRef.current) *
                      ANIMATION_DELAYS.SMALL,
                )
              : undefined
          }
          style={styles.searchItem}
        >
          <Pressable
            style={styles.imageContainer}
            onPress={() => handleItemPress(item, index)}
          >
            {item.images && item.images.length > 0 ? (
              <Image source={item.images[0]} style={styles.itemImage} />
            ) : (
              <View style={[styles.itemImage, styles.noProductImagePlaceholder]}>
                <Text style={styles.noProductImageText}>Нет изображения</Text>
              </View>
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.brand_name}
              </Text>
            </View>
            <PriceTag price={item.price} />
          </Pressable>
        </Animated.View>
      );
    },
    [handleItemPress],
  );

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.LARGE,
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE,
        )}
        style={[
          styles.searchContainer,
          isSearchActive && styles.searchContainerActive,
        ]}
      >
        <View style={styles.searchInputContainer}>
          <TextInput
            style={[
              styles.searchInput,
              isSearchActive && styles.searchInputActive,
            ]}
            placeholder="поиск"
            placeholderTextColor={theme.text.placeholderDark}
            value={searchQuery}
            onChangeText={handleSearch}
            onFocus={handleSearchFocus}
          />

          {isSearchActive && (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
              exiting={FadeOutDown.duration(ANIMATION_DURATIONS.QUICK)}
              style={styles.cancelButtonContainer}
            >
              <TouchableOpacity
                onPress={handleCancelSearch}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>отмена</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </Animated.View>
      {isSearchActive && (
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
          exiting={FadeOutDown.duration(ANIMATION_DURATIONS.QUICK)}
          style={styles.filtersContainer}
        >
          {/* Main Filter Buttons */}
          <View style={styles.filterButtons}>
            {(Object.keys(filterOptions) as (keyof FilterOptions)[]).map(
              (filterType) => (
                <Pressable
                  key={filterType}
                  style={[
                    styles.filterButton,
                    isFilterSelected(filterType) && styles.filterButtonActive,
                  ]}
                  onPress={() =>
                    handleFilterPress(filterType as keyof FilterOptions)
                  }
                >
                  <View style={styles.filterButtonContent}>
                    <Text style={[styles.filterButtonText]}>
                      {FILTER_LABELS[filterType]}
                    </Text>
                    <AntDesign
                      name="caret-down"
                      size={12}
                      style={styles.filterIcon}
                    />
                  </View>
                </Pressable>
              ),
            )}
          </View>

          {/* Options Dropdown */}
          {activeFilter && (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.optionsContainer}
            >
              <View style={styles.optionsHeader}>
                <TouchableOpacity
                  style={styles.okButton}
                  onPress={() => setActiveFilter(null)}
                >
                  <Text style={styles.okButtonText}>OK</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.scrollView}>
                {filterOptions[activeFilter as keyof FilterOptions].map(
                  (option) => (
                    <Pressable
                      key={option}
                      style={[
                        styles.optionButton,
                        isOptionSelected(
                          activeFilter as keyof SelectedFilters,
                          option,
                        ) && styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        handleOptionSelect(
                          activeFilter as keyof FilterOptions,
                          option,
                        )
                      }
                    >
                      <View style={styles.optionButtonContent}>
                        <Text style={[styles.optionButtonText]}>{option}</Text>
                        {isOptionSelected(
                          activeFilter as keyof SelectedFilters,
                          option,
                        ) && (
                          <AntDesign
                            name="check"
                            size={14}
                            style={styles.optionCheckIcon}
                          />
                        )}
                      </View>
                    </Pressable>
                  ),
                )}
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      )}
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.EXTENDED,
        )}
        style={[styles.roundedBox, !isSearchActive && styles.roundedBoxInitial]}
      >
        <Animated.View
          //entering={FadeInDown.duration(400).delay(300)}
          style={{ flex: 1 }}
        >
          {showEmptyState ? (
            <Animated.View
              entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.emptyStateContainer}
            >
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD,
                )}
                style={styles.emptyStateIcon}
              >
                <AntDesign name="search" size={64} color={theme.text.disabled} />
              </Animated.View>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.MEDIUM,
                )}
                style={styles.emptyStateTitle}
              >
                начните поиск
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.LARGE,
                )}
                style={styles.emptyStateDescription}
              >
                введите название товара или используйте фильтры для поиска
              </Animated.Text>
            </Animated.View>
          ) : isLoadingResults ? (
            <Animated.View
              entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.loadingContainer}
            >
              <ActivityIndicator size="large" color={theme.primary} />
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.SMALL,
                )}
                style={styles.loadingText}
              >
                загрузка...
              </Animated.Text>
            </Animated.View>
          ) : showNoResults ? (
            <Animated.View
              entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.noResultsContainer}
            >
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD,
                )}
                style={styles.emptyStateIcon}
              >
                <AntDesign name="inbox" size={64} color={theme.text.disabled} />
              </Animated.View>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.MEDIUM,
                )}
                style={styles.noResultsText}
              >
                ничего не найдено
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.LARGE,
                )}
                style={styles.noResultsDescription}
              >
                попробуйте изменить поисковый запрос или фильтры
              </Animated.Text>
            </Animated.View>
          ) : (
            <FlatList
              key={`search-results-${isSearchActive}`} // Only change key when search mode changes, not when items are added
              style={[
                styles.resultsContainer,
                !isSearchActive && styles.resultsContainerInitial,
              ]}
              data={filteredResults}
              renderItem={renderItem}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              removeClippedSubviews={false} // Prevent items from being removed from view hierarchy
              maintainVisibleContentPosition={
                filteredResults.length > 0
                  ? {
                      minIndexForVisible: 0, // Maintain scroll position when items are prepended (not our case, but good practice)
                    }
                  : undefined
              }
              onEndReached={() => {
                // Load more results when user scrolls to bottom (only in search mode with active query/filters)
                if (
                  isSearchActive &&
                  hasMoreResults &&
                  !isLoadingMoreResults &&
                  !isLoadingResults
                ) {
                  const trimmedQuery = searchQuery.trim();
                  const hasValidQuery =
                    trimmedQuery.length >= MIN_SEARCH_LENGTH;
                  const hasActiveFilters =
                    selectedFilters.category.length > 0 ||
                    selectedFilters.brand.length > 0 ||
                    selectedFilters.style.length > 0;

                  // Only load more if there's an active search (query or filters)
                  if (hasValidQuery || hasActiveFilters) {
                    loadMoreSearchResults();
                  }
                }
              }}
              onEndReachedThreshold={0.5} // Trigger when user is 50% from bottom (Instagram-like behavior)
              ListFooterComponent={
                isLoadingMoreResults ? (
                  <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color={theme.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </Animated.View>
        {!isSearchActive && (
          <AnimatedText
            entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
            style={styles.popularItemsText}
          >
            ПОПУЛЯРНОЕ
          </AnimatedText>
        )}
      </Animated.View>
    </Animated.View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  roundedBox: {
    width: "88%",
    height: "72%",
    borderRadius: 41,
    backgroundColor: theme.background.primary,
    position: "relative",
    //padding: 11,
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  searchContainer: {
    width: "88%",
    marginBottom: "3.6%",
    height: "12%",
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: theme.background.primary,
    borderRadius: 41,
    overflow: "hidden",
  },
  searchContainerActive: {
    // When search is active, make search container slightly wider
    width: "92%",
    shadowOpacity: 0.35, // Make shadow more prominent when active
  },
  filtersContainer: {
    marginBottom: "5%",
    width: "88%",
    zIndex: 998,
    height: "5%",
    borderRadius: 41,
    // backgroundColor: theme.background.primary,
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 10,
  },
  filterButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: "100%",
  },
  filterButton: {
    paddingHorizontal: 20,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.background.primary,
  },
  filterButtonActive: {
    backgroundColor: theme.surface.elevated,
  },
  filterButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 14,
    color: theme.button.primary,
    marginRight: 5,
    textAlignVertical: "center",
  },
  filterButtonTextActive: {
    color: theme.text.inverse,
  },
  filterIcon: {
    color: theme.button.primary,
    marginTop: Platform.OS === "ios" ? -3 : 2,
    alignSelf: "center",
  },
  filterIconActive: {
    color: theme.text.inverse,
  },
  optionsContainer: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: theme.background.primary,
    borderRadius: 17,
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 24,
    zIndex: 999,
    width: "100%",
  },
  scrollView: {
    padding: 8,
    borderRadius: 17,
    width: "70%",
  },
  optionsHeader: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
  },
  okButton: {
    backgroundColor: theme.primary,
    paddingVertical: 20,
    paddingHorizontal: 25,
    borderRadius: 17 - 8, // filter box borderRadius (17) minus padding (4)
  },
  okButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 20,
    color: theme.text.primary,
    fontWeight: "500",
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 17 - 8,
    marginBottom: 5,
  },
  optionButtonActive: {
    backgroundColor: theme.primary,
  },
  optionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 20,
    color: theme.text.primary,
  },
  optionButtonTextActive: {
    color: theme.text.inverse,
  },
  optionCheckIcon: {
    color: theme.text.primary,
  },
  resultsContainer: {
    flex: 1,
    padding: 21, // 1.5:1 ratio with inner spacing (14 * 1.5)
    borderRadius: 41,
  },
  resultsContainerInitial: {
    borderTopLeftRadius: 41,
    borderTopRightRadius: 41,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  listContent: {
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: "space-between",
    paddingHorizontal: 0, // Match recommendations: outer padding handles spacing
  },
  searchItem: {
    width: (width * 0.88 - 42 - 14) / 2, // Container width (88%) - list padding (42 = 21*2) - gap (14, 1.5:1 ratio)
    marginBottom: 14, // 1.5:1 ratio with outer padding
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: theme.surface.item,
    borderRadius: Math.round((0.25 * (width * 0.88 - 42 - 14)) / 2),
  },
  imageContainer: {
    overflow: "hidden",
    aspectRatio: 1,
    position: "relative",
    //padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  itemImage: {
    width: "73%",
    height: "73%",
    resizeMode: "contain",
  },
  noProductImagePlaceholder: {
    backgroundColor: theme.surface.button,
    justifyContent: "center",
    alignItems: "center",
    width: "73%",
    height: "73%",
  },
  noProductImageText: {
    fontFamily: "IgraSans",
    fontSize: 12,
    color: theme.text.disabled,
  },
  itemInfo: {
    // position: 'absolute',
    bottom: -5,
    // left: 10,
    // right: 10,
    alignItems: "center",
    borderRadius: 20,
    padding: 6,
  },
  itemName: {
    fontFamily: "IgraSans",
    fontSize: 13,
    color: theme.text.secondary,
    textAlign: "center",
    paddingHorizontal: 10,
  },
  priceContainer: {
    // Position and dimensions are set dynamically in PriceTag component
    // No absolute positioning - uses flexbox alignment and transforms
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  itemPrice: {
    fontFamily: "REM",
    fontSize: 14,
    color: theme.text.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyStateIcon: {
    marginBottom: 24,
    opacity: 0.4,
  },
  emptyStateTitle: {
    fontFamily: "REM",
    fontSize: 24,
    fontWeight: "600",
    color: theme.text.secondary,
    textAlign: "center",
    marginBottom: 12,
  },
  emptyStateDescription: {
    fontFamily: "REM",
    fontSize: 16,
    color: theme.text.tertiary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  noResultsText: {
    fontFamily: "REM",
    fontSize: 24,
    fontWeight: "600",
    color: theme.text.secondary,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  noResultsDescription: {
    fontFamily: "REM",
    fontSize: 16,
    color: theme.text.tertiary,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    fontFamily: "REM",
    fontSize: 18,
    color: theme.text.tertiary,
    textAlign: "center",
    marginTop: 20,
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  searchContainerInitial: {
    marginBottom: "5%",
  },
  roundedBoxInitial: {
    height: "80%",
  },
  popularItemsText: {
    fontFamily: "Igra Sans",
    fontSize: 38,
    color: theme.text.coldgrey,
    textAlign: "left",
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 25,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
    paddingHorizontal: 15,
  },
  searchInput: {
    fontSize: 30,
    fontFamily: "Igra Sans",
    flex: 1,
    height: "100%",
    paddingVertical: 10,
    color: theme.text.primary,
  },
  searchInputActive: {
    fontSize: 26,
  },
  cancelButtonContainer: {
    marginRight: -15,
  },
  cancelButton: {
    paddingHorizontal: Platform.OS === "ios" ? 45 : 50,
    backgroundColor: theme.button.cancel,
    borderRadius: 41,
    // paddingVertical: Platform.OS === "ios" ? 34 : 27,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 18,
    color: theme.button.primary,
  },
});

export default Search;
