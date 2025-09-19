import React, { useState, useEffect } from "react";
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

import { ImageSourcePropType } from "react-native";
import { CardItem, ProductVariant } from "./types/product";

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
    const params: any = {
      limit: count,
      offset,
    };
    if (query) params.query = query;
    if (filters.category && filters.category !== "Категория")
      params.category = filters.category;
    if (filters.brand && filters.brand !== "Бренд")
      params.brand = filters.brand;
    if (filters.style && filters.style !== "Стиль")
      params.style = filters.style;
    const results = await api.getProductSearchResults(params);
    return results.map((item: api.Product) => ({
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

    // Otherwise initialize with an empty array, and let fetchMoreSearchResults populate it
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

  useEffect(() => {
    const loadFilters = async () => {
      setIsLoadingFilters(true);
      try {
        const [brands, styles, categories] = await Promise.all([
          api.getBrands(),
          api.getStyles(),
          api.getCategories(),
        ]);
        setFilterOptions({
          brand: brands.map((b: any) => b.name),
          style: styles.map((s: any) => s.id), // use id for search param
          category: categories.map((c: any) => c.id), // use id for search param
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
  const filteredResults =
    searchQuery.length > 0
      ? searchResults.filter((item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : searchResults;

  // Update persistent storage whenever searchResults change
  useEffect(() => {
    persistentSearchStorage.results = searchResults;
    console.log(
      "Search - Updated persistent storage with results:",
      searchResults
    );
  }, [searchResults]);

  // Fetch new results when search query or filters change
  useEffect(() => {
    // Only fetch if the search is active (user has clicked in the search field)
    if (isSearchActive) {
      // Add a small delay to avoid fetching on every keystroke
      const timer = setTimeout(() => {
        console.log("Search - Query or filters changed, fetching new results");
        fetchMoreSearchResults(searchQuery, selectedFilters, 4).then(
          (apiResults) => {
            setSearchResults((prevResults) => {
              // If search query changed, replace all results
              // If just filters changed, append to existing results
              const wasQueryChange = searchQuery.length > 0;
              const updatedResults = wasQueryChange
                ? apiResults
                : [...prevResults, ...apiResults];

              // Update persistent storage
              persistentSearchStorage.results = updatedResults;
              console.log(
                "Search - Updated results with query change, total count:",
                updatedResults.length
              );

              return updatedResults;
            });
          }
        );
      }, 500); // 500ms debounce

      return () => clearTimeout(timer);
    }
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

    // Dismiss the keyboard if it's open
    Keyboard.dismiss();

    // Exit search mode with animation
    setIsSearchActive(false);
  };

  const renderItem = ({ item, index }: { item: SearchItem; index: number }) => (
    <Animated.View
      entering={FadeInDown.duration(300).delay(100 + index * 50)}
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
    <Animated.View style={styles.container} exiting={FadeOutDown.duration(50)}>
      <Animated.View
        entering={FadeInDown.duration(500).delay(200)}
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
              entering={FadeInDown.duration(300)}
              exiting={FadeOutDown.duration(100)}
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
          entering={FadeInDown.duration(500)}
          exiting={FadeOutDown.duration(100)}
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
              entering={FadeInDown.duration(300)}
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
        entering={FadeInDown.duration(500).delay(250)}
        style={[styles.roundedBox, !isSearchActive && styles.roundedBoxInitial]}
      >
        <Animated.View
          //entering={FadeInDown.duration(400).delay(300)}
          style={{ flex: 1 }}
        >
          {filteredResults.length === 0 ? (
            <View style={styles.noResultsContainer}>
              <Text style={styles.noResultsText}>Результаты не найдены</Text>
              <Text style={styles.loadingText}>Загрузка...</Text>
            </View>
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
            entering={FadeInDown.duration(300)}
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
  noResultsText: {
    fontFamily: "REM",
    fontSize: 16,
    color: "white",
    textAlign: "center",
    marginTop: 20,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    fontFamily: "REM",
    fontSize: 14,
    color: "gray",
    textAlign: "center",
    marginTop: 10,
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
