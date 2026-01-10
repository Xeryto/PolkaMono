import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Image,
  Dimensions,
  Platform,
  TouchableOpacity,
  Keyboard,
  ScrollView,
  ActivityIndicator,
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

// Create animated text component using proper method for this version
const AnimatedText = Animated.createAnimatedComponent(Text);

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

interface SelectedFilters {
  category: string;
  brand: string;
  style: string;
}

// Minimum search query length before sending API request
const MIN_SEARCH_LENGTH = 2;

// Replace simulated API with real product search
const fetchMoreSearchResults = async (
  query: string = "",
  filters: SelectedFilters = {
    category: "Категория",
    brand: "Бренд",
    style: "Стиль",
  },
  count: number = 4,
  offset: number = 0
): Promise<SearchItem[]> => {
  try {
    // Trim query and check if it's blank or all spaces
    const trimmedQuery = query.trim();
    const hasValidQuery = trimmedQuery.length >= MIN_SEARCH_LENGTH;
    
    // Check if any filter is actively selected (not default)
    const hasActiveFilters = 
      filters.category !== "Категория" ||
      filters.brand !== "Бренд" ||
      filters.style !== "Стиль";
    
    // Don't make API call if query is too short and no active filters
    if (!hasValidQuery && !hasActiveFilters) {
      console.log(`Search - Skipping API call: query too short (${trimmedQuery.length} chars, need ${MIN_SEARCH_LENGTH}) and no active filters`);
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
    if (filters.category && filters.category !== "Категория")
      params.category = filters.category;
    if (filters.brand && filters.brand !== "Бренд")
      params.brand = filters.brand;
    if (filters.style && filters.style !== "Стиль")
      params.style = filters.style;
    
    const results = await apiWrapper.getProductSearchResults(
      params,
      "SearchPage"
    );
    if (!results) return [];
    
    // Deduplicate by product ID (defensive measure in case API returns duplicates)
    // Use a Map to preserve order while removing duplicates (last occurrence wins)
    const seenIds = new Map<string, api.Product>();
    for (const item of results) {
      seenIds.set(item.id, item);
    }
    const uniqueResults = Array.from(seenIds.values());
    
    return uniqueResults.map((item: api.Product) => ({
      id: item.id,
      name: item.name,
      brand_name: item.brand_name || `Brand ${item.brand_id}`,
      price: item.price,
      images:
        item.images && item.images.length > 0
          ? item.images.map((img) => ({ uri: img }))
          : [require("./assets/Vision.png"), require("./assets/Vision2.png")],
      isLiked: item.is_liked || false,
      description: item.description || "",
      color: item.color || "",
      materials: item.material || "",
      brand_return_policy: item.brand_return_policy || item.return_policy || "",
      variants: item.variants || [],
    }));
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
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeFilter, setActiveFilter] = useState<keyof FilterOptions | null>(
    null
  );
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>({
    category: "Категория",
    brand: "Бренд",
    style: "Стиль",
  });

  // Initialize searchResults with persistent storage or default items
  const [searchResults, setSearchResults] = useState<SearchItem[]>(() => {
    // If we already have results in our persistent storage, use those
    if (persistentSearchStorage.initialized) {
      console.log(
        "Search - Using persistent results:",
        persistentSearchStorage.results
      );
      return persistentSearchStorage.results;
    }

    // Otherwise initialize with an empty array, will be populated with popular items on mount
    persistentSearchStorage.results = [];
    persistentSearchStorage.initialized = true;
    console.log(
      "Search - Initialized persistent results storage with empty array"
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

  // Track previous filter values to detect filter-only changes
  const prevFiltersRef = useRef<SelectedFilters>(selectedFilters);
  const prevSearchQueryRef = useRef<string>(searchQuery);
  // Track request ID to prevent stale results from overwriting newer ones
  const requestIdRef = useRef<number>(0);

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
          style: styles?.map((s: any) => s.id) || [], // use id for search param
          category: categories?.map((c: any) => c.id) || [], // use id for search param
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
    console.log("Search - Loading popular items");
    setIsLoadingResults(true);
    try {
      const popularItems = await apiWrapper.getPopularItems(8, "SearchPage");
      if (popularItems && popularItems.length > 0) {
        // Deduplicate by product ID (defensive measure)
        const seenIds = new Map<string, api.Product>();
        for (const item of popularItems) {
          seenIds.set(item.id, item);
        }
        const uniquePopularItems = Array.from(seenIds.values());
        
        const mappedItems: SearchItem[] = uniquePopularItems.map((item: api.Product) => ({
          id: item.id,
          name: item.name,
          brand_name: item.brand_name || `Brand ${item.brand_id}`,
          price: item.price,
          images:
            item.images && item.images.length > 0
              ? item.images.map((img) => ({ uri: img }))
              : [require("./assets/Vision.png"), require("./assets/Vision2.png")],
          isLiked: item.is_liked || false,
          description: item.description || "",
          color: item.color || "",
          materials: item.material || "",
          brand_return_policy: item.brand_return_policy || item.return_policy || "",
          variants: item.variants || [],
        }));
        setSearchResults(mappedItems);
        persistentSearchStorage.results = mappedItems;
        console.log("Search - Loaded popular items:", mappedItems.length, `(deduplicated from ${popularItems.length})`);
      } else {
        // No popular items found, keep results empty
        setSearchResults([]);
        persistentSearchStorage.results = [];
      }
    } catch (error) {
      console.error("Error loading popular items:", error);
      // On error, keep results empty
      setSearchResults([]);
      persistentSearchStorage.results = [];
    } finally {
      setIsLoadingResults(false);
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
      selectedFiltersRef.current.category !== "Категория" ||
      selectedFiltersRef.current.brand !== "Бренд" ||
      selectedFiltersRef.current.style !== "Стиль";
    
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
      // If exiting search mode, clear search results first
      if (exitingSearchMode) {
        console.log("Search - Exiting search mode, clearing results and loading popular items");
        setSearchResults([]);
        persistentSearchStorage.results = [];
        popularItemsLoadedRef.current = false;
        searchResultsLengthRef.current = 0;
      }
      
      // Load popular items if:
      // - Initial mount and no results, OR
      // - Exiting search mode (already cleared above), OR
      // - We haven't loaded them yet
      const shouldLoad = (isInitialMount && searchResultsLengthRef.current === 0) || exitingSearchMode || !popularItemsLoadedRef.current;
      
      if (shouldLoad) {
        console.log(`Search - Loading popular items (initial: ${isInitialMount}, exiting: ${exitingSearchMode})`);
        loadPopularItems().then(() => {
          popularItemsLoadedRef.current = true;
        }).catch(() => {
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
    option: string
  ) => {
    const defaultValues = {
      category: "Категория",
      brand: "Бренд",
      style: "Стиль",
    };

    setSelectedFilters((prev) => ({
      ...prev,
      [filterType]:
        prev[filterType] === option ? defaultValues[filterType] : option,
    }));
    setActiveFilter(null);
  };

  const isFilterSelected = (filterType: keyof SelectedFilters): boolean => {
    const defaultValues = {
      category: "Категория",
      brand: "Бренд",
      style: "Стиль",
    };
    return selectedFilters[filterType] !== defaultValues[filterType];
  };

  // Handle item selection and removal
  const handleItemPress = (item: SearchItem, index: number) => {
    // Create params to pass the selected item to MainPage first
    // This ensures we have the item data before removing it
    const params = {
      addCardItem: {
        id: item.id,
        name: item.name,
        brand_name: item.brand_name,
        price: item.price,
        images: item.images, // This should be an array
        isLiked: item.isLiked,
        description: item.description,
        color: item.color,
        materials: item.materials,
        brand_return_policy: item.brand_return_policy,
        variants: item.variants,
      },
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
        newResults.length
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
                  updatedResults.length
                );

                // Update persistent storage
                persistentSearchStorage.results = updatedResults;
                return updatedResults;
              });
            }
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
    selectedFilters.category !== "Категория" ||
    selectedFilters.brand !== "Бренд" ||
    selectedFilters.style !== "Стиль";
  
  // Only filter results if query is valid (meets minimum length)
  // If query is too short, show all existing results (or empty if no results exist)
  const filteredResults = hasValidQuery
    ? searchResults.filter((item) =>
        item.name.toLowerCase().includes(trimmedQuery.toLowerCase())
      )
    : searchResults;
  
  // Check if we should show the empty state
  // Show empty state when:
  // 1. NOT in search mode and no results (shows popular items placeholder)
  // 2. IN search mode with no query/filters (shows "start search" message)
  const showEmptyState = (!hasValidQuery && !hasActiveFilters) && !isLoadingResults && filteredResults.length === 0;
  // Check if there are no results but there was a valid query/filter (only when not loading)
  const showNoResults = !isLoadingResults && (hasValidQuery || hasActiveFilters) && filteredResults.length === 0;

  // Update persistent storage whenever searchResults change
  useEffect(() => {
    persistentSearchStorage.results = searchResults;
    console.log(
      "Search - Updated persistent storage with results:",
      searchResults
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
        console.log("Search - Entering search mode, clearing popular items and showing empty search state");
        setSearchResults([]);
        persistentSearchStorage.results = [];
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
        selectedFilters.category !== "Категория" ||
        selectedFilters.brand !== "Бренд" ||
        selectedFilters.style !== "Стиль";
      
      // Detect if filters changed (but search query didn't)
      const filtersChanged = 
        prevFiltersRef.current.category !== selectedFilters.category ||
        prevFiltersRef.current.brand !== selectedFilters.brand ||
        prevFiltersRef.current.style !== selectedFilters.style;
      
      const searchQueryChanged = prevSearchQueryRef.current !== searchQuery;
      
      // If filters changed, clear results immediately to prevent stacking and show loading
      // BUT only if we have active filters, not if filters were just reset
      if (filtersChanged && hasActiveFilters) {
        setSearchResults([]);
        persistentSearchStorage.results = [];
        setIsLoadingResults(true); // Show loading spinner immediately when filters change
        console.log("Search - Filters changed, clearing previous results and showing loading");
      }
      
      // Only send query if there's a valid search term (min length) or active filters
      if (!hasValidQuery && !hasActiveFilters) {
        // Query too short or no active filters - clear results to show empty search state
        // When in search mode, we always want to show the "start search" message, not popular items
        setSearchResults([]);
        persistentSearchStorage.results = [];
        setIsLoadingResults(false); // Not loading since we're skipping the API call
        // Update refs even if we skip the API call
        prevFiltersRef.current = selectedFilters;
        prevSearchQueryRef.current = searchQuery;
        console.log("Search - No query or filters, showing empty search state");
        return;
      }
      
      // Use minimal debounce (50ms) if only filters changed, otherwise use 800ms for query changes
      const debounceDelay = filtersChanged && !searchQueryChanged ? 50 : 800;

      // Add a delay to avoid fetching on every keystroke (or immediate for filter changes)
      const timer = setTimeout(() => {
        // Re-check if query is still valid after debounce delay
        const currentTrimmedQuery = searchQuery.trim();
        const currentHasValidQuery = currentTrimmedQuery.length >= MIN_SEARCH_LENGTH;
        
        // Re-check if filters changed (capture at timeout execution time)
        const filtersChangedAtTimeout = 
          prevFiltersRef.current.category !== selectedFilters.category ||
          prevFiltersRef.current.brand !== selectedFilters.brand ||
          prevFiltersRef.current.style !== selectedFilters.style;
        
        // Check if any filter is actively selected (not default)
        const currentHasActiveFilters = 
          selectedFilters.category !== "Категория" ||
          selectedFilters.brand !== "Бренд" ||
          selectedFilters.style !== "Стиль";
        
        if (!currentHasValidQuery && !currentHasActiveFilters) {
          // Query is too short or empty - clear results and show empty search state
          // When in search mode, we always show empty state when there's no query/filters
          setSearchResults([]);
          persistentSearchStorage.results = [];
          setIsLoadingResults(false); // Not loading since we're skipping
          // Update refs before returning
          prevFiltersRef.current = selectedFilters;
          prevSearchQueryRef.current = searchQuery;
          console.log("Search - No valid query or filters after debounce, showing empty search state");
          return;
        }

        // Increment request ID for this new request
        const currentRequestId = ++requestIdRef.current;
        
        // Show loading spinner when starting a new API call
        setIsLoadingResults(true);
        
        console.log("Search - Query or filters changed, fetching new results");
        fetchMoreSearchResults(
          currentHasValidQuery ? currentTrimmedQuery : "", // Only send query if it meets minimum length
          selectedFilters, 
          4
        ).then(
          (apiResults) => {
            // Only update results if this is still the latest request (prevents stale results from overwriting newer ones)
            if (currentRequestId === requestIdRef.current) {
              // Always replace results with new API results since this is a new search query/filter combination
              setSearchResults(apiResults);
              // Update persistent storage
              persistentSearchStorage.results = apiResults;
              setIsLoadingResults(false); // Hide loading spinner
              console.log(
                `Search - ${filtersChangedAtTimeout ? 'Filters changed' : 'Query changed'}, replaced results. Total count:`,
                apiResults.length
              );
              
              // Update refs after successfully updating results
              prevFiltersRef.current = selectedFilters;
              prevSearchQueryRef.current = searchQuery;
            } else {
              console.log(`Search - Ignoring stale results (request ${currentRequestId} is not the latest ${requestIdRef.current})`);
              // Don't update loading state for stale requests - let the latest request handle it
            }
          }
        ).catch((error) => {
          // Only update state if this is still the latest request
          if (currentRequestId === requestIdRef.current) {
            setIsLoadingResults(false); // Hide loading spinner on error
            prevFiltersRef.current = selectedFilters;
            prevSearchQueryRef.current = searchQuery;
          } else {
            console.log(`Search - Ignoring error from stale request (request ${currentRequestId} is not the latest ${requestIdRef.current})`);
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
  }, [
    searchQuery,
    selectedFilters.category,
    selectedFilters.brand,
    selectedFilters.style,
    isSearchActive,
  ]);

  // Handle cancel search
  const handleCancelSearch = () => {
    // Reset search query
    setSearchQuery("");

    // Reset any active filters
    setActiveFilter(null);
    setSelectedFilters({
      category: "Категория",
      brand: "Бренд",
      style: "Стиль",
    });

    // Clear search results immediately
    setSearchResults([]);
    persistentSearchStorage.results = [];

    // Dismiss the keyboard if it's open
    Keyboard.dismiss();

    // Exit search mode with animation
    // The useEffect watching isSearchActive will load popular items when it becomes false
    setIsSearchActive(false);
  };

  const renderItem = ({ item, index }: { item: SearchItem; index: number }) => (
    <Animated.View
      entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD).delay(
        ANIMATION_DELAYS.STANDARD + index * ANIMATION_DELAYS.SMALL
      )}
      style={styles.searchItem}
    >
      <Pressable
        style={styles.imageContainer}
        onPress={() => handleItemPress(item, index)}
      >
        <Image source={item.images[0]} style={styles.itemImage} />
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.itemPrice}>{`${item.price.toFixed(2)} ₽`}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <Animated.View
      style={styles.container}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE
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
            placeholder="Поиск"
            placeholderTextColor="rgba(0,0,0,0.6)"
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
                //activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
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
            {Object.keys(filterOptions).map((filterType) => (
              <Pressable
                key={filterType}
                style={[
                  styles.filterButton,
                  isFilterSelected(filterType as keyof SelectedFilters) &&
                    styles.filterButtonActive,
                ]}
                onPress={() =>
                  handleFilterPress(filterType as keyof FilterOptions)
                }
              >
                <View style={styles.filterButtonContent}>
                  <Text
                    style={[
                      styles.filterButtonText,
                      isFilterSelected(filterType as keyof SelectedFilters) &&
                        styles.filterButtonTextActive,
                    ]}
                  >
                    {selectedFilters[filterType as keyof SelectedFilters]}
                  </Text>
                  <AntDesign
                    name="caret-down"
                    size={12}
                    style={[
                      styles.filterIcon,
                      isFilterSelected(filterType as keyof SelectedFilters) &&
                        styles.filterIconActive,
                    ]}
                  />
                </View>
              </Pressable>
            ))}
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
                        selectedFilters[
                          activeFilter as keyof SelectedFilters
                        ] === option && styles.optionButtonActive,
                      ]}
                      onPress={() =>
                        handleOptionSelect(
                          activeFilter as keyof FilterOptions,
                          option
                        )
                      }
                    >
                      <View style={styles.optionButtonContent}>
                        <Text
                          style={[
                            styles.optionButtonText,
                            selectedFilters[
                              activeFilter as keyof SelectedFilters
                            ] === option && styles.optionButtonTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                        {selectedFilters[
                          activeFilter as keyof SelectedFilters
                        ] === option && (
                          <AntDesign
                            name="check"
                            size={14}
                            style={styles.optionCheckIcon}
                          />
                        )}
                      </View>
                    </Pressable>
                  )
                )}
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      )}
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.EXTENDED
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
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.STANDARD)}
                style={styles.emptyStateIcon}
              >
                <AntDesign name="search" size={64} color="rgba(0,0,0,0.3)" />
              </Animated.View>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.MEDIUM)}
                style={styles.emptyStateTitle}
              >
                Начните поиск
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.LARGE)}
                style={styles.emptyStateDescription}
              >
                Введите название товара или используйте фильтры для поиска
              </Animated.Text>
            </Animated.View>
          ) : isLoadingResults ? (
            <Animated.View
              entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.loadingContainer}
            >
              <ActivityIndicator size="large" color="#CDA67A" />
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.SMALL)}
                style={styles.loadingText}
              >
                Загрузка...
              </Animated.Text>
            </Animated.View>
          ) : showNoResults ? (
            <Animated.View
              entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
              style={styles.noResultsContainer}
            >
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.STANDARD)}
                style={styles.emptyStateIcon}
              >
                <AntDesign name="inbox" size={64} color="rgba(0,0,0,0.3)" />
              </Animated.View>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.MEDIUM)}
                style={styles.noResultsText}
              >
                Ничего не найдено
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.LARGE)}
                style={styles.noResultsDescription}
              >
                Попробуйте изменить поисковый запрос или фильтры
              </Animated.Text>
            </Animated.View>
          ) : (
            <FlatList
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  roundedBox: {
    width: "88%",
    height: "72%",
    borderRadius: 41,
    backgroundColor: "#F2ECE7",
    position: "relative",
    //padding: 11,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  searchContainer: {
    width: "88%",
    marginBottom: "3.6%",
    height: "12%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    overflow: "hidden", // Ensures the children don't overflow the rounded corners
  },
  searchContainerActive: {
    // When search is active, make search container slightly wider
    width: "92%",
    shadowOpacity: 0.35, // Make shadow more prominent when active
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
    paddingVertical: 10, // Add some vertical padding
  },
  searchInputActive: {
    // Slightly smaller font when search is active to make room for cancel button
    fontSize: 26,
  },
  filtersContainer: {
    marginBottom: "5%",
    width: "88%",
    zIndex: 998,
    height: "5%",
    borderRadius: 41,
    backgroundColor: "#F2ECE7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 10,
  },
  filterButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    //padding: 4,
    height: "100%",
    //marginHorizontal: -4
  },
  filterButton: {
    //flex: 1,s
    //paddingVertical: 4,
    paddingHorizontal: 20,
    borderRadius: 41,
    //marginHorizontal: 4,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: -1,
  },
  filterButtonActive: {
    backgroundColor: "#CDA67A",
  },
  filterButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  filterButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 14,
    color: "#4A3120",
    marginRight: 5,
    textAlignVertical: "center",
  },
  filterButtonTextActive: {
    color: "white",
  },
  filterIcon: {
    color: "#4A3120",
    marginTop: Platform.OS === "ios" ? -3 : 2,
    alignSelf: "center",
  },
  filterIconActive: {
    color: "white",
  },
  optionsContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F2ECE7",
    borderRadius: 17,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 24,
    zIndex: 999,
  },
  scrollView: {
    padding: 4,
    borderRadius: 17,
    width: "70%",
  },
  optionsHeader: {
    position: "absolute",
    top: 4,
    right: 4,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
  },
  okButton: {
    backgroundColor: "#CDA57A",
    paddingVertical: 20,
    paddingHorizontal: 25,
    borderRadius: 41,
  },
  okButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 20,
    color: "black",
    fontWeight: "500",
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginVertical: 5,
  },
  optionButtonActive: {
    backgroundColor: "#CDA67A",
  },
  optionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  optionButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 20,
    color: "#000",
  },
  optionButtonTextActive: {
    color: "white",
  },
  optionCheckIcon: {
    color: "white",
  },
  resultsContainer: {
    flex: 1,
    padding: 11,
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
    paddingHorizontal: 5,
  },
  searchItem: {
    width: "47%",
    marginBottom: 17,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    backgroundColor: "#EDE7E2",
    borderRadius: 40,
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
    color: "#4A3120",
    textAlign: "center",
    paddingHorizontal: 10,
  },
  priceContainer: {
    position: "absolute",
    right: -20,
    top: "50%",
    transform: [{ translateY: -20 }, { rotate: "90deg" }],
    //backgroundColor: 'rgba(242, 236, 231, 0.8)',
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  itemPrice: {
    fontFamily: "REM",
    fontSize: 14,
    color: "#4A3120",
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
    color: "#4A3120",
    textAlign: "center",
    marginBottom: 12,
  },
  emptyStateDescription: {
    fontFamily: "REM",
    fontSize: 16,
    color: "rgba(74, 49, 32, 0.7)",
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
    color: "#4A3120",
    textAlign: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  noResultsDescription: {
    fontFamily: "REM",
    fontSize: 16,
    color: "rgba(74, 49, 32, 0.7)",
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
    color: "rgba(74, 49, 32, 0.7)",
    textAlign: "center",
    marginTop: 20,
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
    color: "#73706D",
    textAlign: "left",
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 25,
  },
  cancelButtonContainer: {
    marginRight: -15,
  },
  cancelButton: {
    paddingHorizontal: Platform.OS === "ios" ? 45 : 50, // Smaller padding on Android
    backgroundColor: "#C8A688",
    borderRadius: 41,
    paddingVertical: Platform.OS === "ios" ? 34 : 27, // Smaller on Android
    height: "100%",
  },
  cancelButtonText: {
    fontFamily: "Igra Sans",
    fontSize: 18,
    color: "#4A3120",
  },
});

export default Search;
