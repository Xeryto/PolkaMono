import React, {
  useState,
  useEffect,
  useRef,
  memo,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  Dimensions,
  useWindowDimensions,
  TextInput,
  Platform,
  InteractionManager,
  TouchableOpacity,
  Animated as RNAnimated,
  Easing as RNEasing,
  ListRenderItem,
  ListRenderItemInfo,
  FlexAlignType,
  FlexStyle,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
  FadeOut,
  runOnJS,
} from "react-native-reanimated";
import { AntDesign } from "@expo/vector-icons";
import PlusSvg from "./components/svg/PlusSvg";
import BackIcon from "./components/svg/BackIcon";
import Tick from "./assets/Tick";
import CancelIcon from "./components/svg/CancelThinIcon";
import CancelThickIcon from "./components/svg/CancelThickIcon";
import PlusIcon from "./components/svg/PlusBlackIcon";
import CheckIcon from "./components/svg/CheckIcon";
import AvatarImage from "./components/AvatarImage";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as api from "./services/api";
import { apiWrapper } from "./services/apiWrapper";
import {
  CardItem,
  FavoriteItem,
  RecommendedItem,
  FriendItem,
  FriendRequestItem,
} from "./types/product";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "./lib/animations";
import { mapProductToCardItem } from "./lib/productMapper";
import { useTheme } from "./lib/ThemeContext";
import type { ThemeColors } from "./lib/theme";
import { useStaleFocusEffect } from "./lib/useStaleFocusEffect";
import PriceTag from "./components/PriceTag";
import { SkeletonGrid } from "./components/SkeletonCard";

// Define a simpler navigation type that our custom navigation can satisfy
interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  addListener?: (event: string, callback: () => void) => () => void;
}

interface FavoritesProps {
  navigation: SimpleNavigation;
}

interface UserActionButtonProps {
  status: FriendItem["status"];
  onAddFriend?: () => void;
  onCancelRequest?: () => void;
  onAcceptRequest?: () => void;
  onRejectRequest?: () => void;
  onRemoveFriend?: () => void;
  styles: any;
  width: number;
}

const { width, height } = Dimensions.get("window");

const ANIMATION_CONFIG = {
  duration: 400,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// UserActionButton: renders the correct action button for a user status
const UserActionButton = memo(
  ({
    status,
    onAddFriend,
    onCancelRequest,
    onAcceptRequest,
    onRejectRequest,
    onRemoveFriend,
    styles,
    width,
  }: UserActionButtonProps) => {
    // Button container style for non-overlay buttons
    const buttonContainerStyle = {
      width: width * 0.15,
      height: width * 0.15,
      justifyContent: "center" as FlexStyle["justifyContent"],
      alignItems: "center" as FlexAlignType,
    };

    if (status === "friend") {
      // This is an overlay button. Return it without the container so it doesn't affect the layout.
      return (
        <TouchableOpacity
          style={styles.removeFriendButton}
          onPress={onRemoveFriend}
        >
          <CancelThickIcon />
        </TouchableOpacity>
      );
    }

    // For all other statuses, the button is part of the layout flow, so it needs the container.
    const otherButtons = (
      <>
        {status === "request_received" && (
          <View style={styles.stackedButtonsContainer}>
            <TouchableOpacity
              style={[styles.stackedButton, styles.acceptButton]}
              onPress={onAcceptRequest}
            >
              <CheckIcon width={width * 0.1} height={width * 0.1} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stackedButton, styles.rejectButton]}
              onPress={onRejectRequest}
            >
              <CancelIcon width={width * 0.12} height={width * 0.12} />
            </TouchableOpacity>
          </View>
        )}
        {status === "not_friend" && (
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
          >
            <TouchableOpacity
              style={[styles.addFriendButton, styles.stackedButton]}
              onPress={onAddFriend}
            >
              <PlusIcon />
            </TouchableOpacity>
          </Animated.View>
        )}
        {status === "request_sent" && (
          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
          >
            <TouchableOpacity
              style={[
                styles.stackedButton,
                styles.rejectButton,
                styles.cancelRequestButton,
              ]}
              onPress={onCancelRequest}
            >
              <Text style={styles.cancelRequestText}>отменить заявку</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </>
    );

    return <View style={buttonContainerStyle}>{otherButtons}</View>;
  },
);

const Favorites = ({ navigation }: FavoritesProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Basic state
  const [activeView, setActiveView] = useState<"friends" | "saved">("friends");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMounted, setIsMounted] = useState(true);
  const [isReady, setIsReady] = useState(true); // Always ready for smooth transitions
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [customRecommendations, setCustomRecommendations] = useState<{
    [key: string]: CardItem[];
  }>({});

  // Friend data state
  const [friendItems, setFriendItems] = useState<FriendItem[]>([]);
  const [sentRequests, setSentRequests] = useState<api.FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<api.FriendRequest[]>(
    [],
  );
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [searchResults, setSearchResults] = useState<FriendItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [mainPendingRemoval, setMainPendingRemoval] =
    useState<FriendItem | null>(null);
  const [mainShowConfirmDialog, setMainShowConfirmDialog] = useState(false);
  const [searchPendingRemoval, setSearchPendingRemoval] =
    useState<FriendItem | null>(null);
  const [searchShowConfirmDialog, setSearchShowConfirmDialog] = useState(false);

  // Opacity values for the main view and search view
  const mainViewOpacity = useSharedValue(1);
  const searchViewOpacity = useSharedValue(0);
  const profileViewOpacity = useSharedValue(0);

  // Animation value for press animation
  const pressAnimationScale = useSharedValue(1);

  // Saved items state
  const [savedItems, setSavedItems] = useState<CardItem[]>([]);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);

  const [friendRecommendations, setFriendRecommendations] = useState<{
    [key: string]: CardItem[];
  }>({});
  const [isLoadingFriendRecs, setIsLoadingFriendRecs] = useState<{
    [key: string]: boolean;
  }>({});

  // Refresh friends data when tab gains focus (if stale >30s)
  useStaleFocusEffect(
    useCallback(() => {
      loadFriendsData();
    }, []),
    30_000,
  );

  // Update loadFriendsData to remove session check
  const loadFriendsData = async () => {
    try {
      setIsLoadingFriends(true);

      // Load friends, sent requests, and received requests in parallel
      const [friends, sent, received] = await Promise.all([
        apiWrapper.getFriends("FavoritesPage"),
        apiWrapper.getSentFriendRequests("FavoritesPage"),
        apiWrapper.getReceivedFriendRequests("FavoritesPage"),
      ]);

      console.log("API Response - Friends:", friends);
      console.log("API Response - Sent Requests:", sent);
      console.log("API Response - Received Requests:", received);

      // Convert API friends to FriendItem format - handle null values
      const friendsList: FriendItem[] = (friends || []).map((friend) => ({
        ...friend,
        status: "friend" as const,
      }));

      // Convert sent requests to FriendItem format - handle null values
      const sentRequestsList: FriendItem[] = (sent || [])
        .filter((request) => request.status === "pending")
        .map((request) => ({
          id: request.recipient?.id || "",
          username: request.recipient?.username || "",
          email: "",
          status: "request_sent" as const,
          requestId: request.id,
        }));

      // Convert received requests to FriendItem format - handle null values
      const receivedRequestsList: FriendItem[] = (received || [])
        .filter((request) => request.status === "pending")
        .map((request) => ({
          id: request.sender?.id || "",
          username: request.sender?.username || "",
          email: "",
          status: "request_received" as const,
          requestId: request.id,
        }));

      const allFriendItems = [
        ...receivedRequestsList, // First: received friend invitations
        ...friendsList, // Second: added friends
        ...sentRequestsList, // Third: sent friendship invitations
      ];
      console.log("Processed Friend Items:", allFriendItems);

      setFriendItems(allFriendItems);
      setSentRequests(sent || []);
      setReceivedRequests(received || []);
    } catch (error: any) {
      console.error("Error loading friends data:", error);
      // Don't show alerts for authentication errors
      if (error.status !== 401) {
        Alert.alert("ошибка", "не удалось загрузить список друзей");
      }
    } finally {
      setIsLoadingFriends(false);
    }
  };

  // Refresh saved items when tab gains focus (if stale >30s)
  const loadSavedItems = useCallback(async () => {
    setIsLoadingSaved(true);
    try {
      const favorites = await apiWrapper.getUserFavorites("FavoritesPage");
      setSavedItems(
        (favorites || []).map(
          (item: api.Product, i: number): CardItem =>
            mapProductToCardItem(item, i),
        ),
      );
    } catch (error: any) {
      console.error("Error loading saved items:", error);
      if (error.status !== 401) {
        setSavedItems([]);
      }
    } finally {
      setIsLoadingSaved(false);
    }
  }, []);
  useStaleFocusEffect(loadSavedItems, 30_000);

  // Note: Friend recommendations are now loaded in FriendProfileView component

  // Animated styles for views
  const mainViewAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: mainViewOpacity.value,
    display: mainViewOpacity.value === 0 ? "none" : "flex",
    justifyContent: "flex-start",
    alignItems: "center",
  }));

  const searchViewAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: searchViewOpacity.value,
    display: searchViewOpacity.value === 0 ? "none" : "flex",
  }));

  const profileViewAnimatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    width: "100%",
    height: "100%",
    opacity: profileViewOpacity.value,
    display: profileViewOpacity.value === 0 ? "none" : "flex",
    justifyContent: "center",
    alignItems: "center",
  }));

  // Create animated style for bottom box press animation only
  const bottomBoxAnimatedStyle = useAnimatedStyle(() => ({
    opacity: 1,
    transform: [{ scale: pressAnimationScale.value }],
  }));

  // Removed InteractionManager delay - screen renders immediately for smooth transitions

  // Cleanup animations on unmount
  useEffect(() => {
    setIsMounted(true);

    return () => {
      setIsMounted(false);
      cancelAnimation(mainViewOpacity);
      cancelAnimation(searchViewOpacity);
      cancelAnimation(profileViewOpacity);
      cancelAnimation(pressAnimationScale);
    };
  }, []);

  // Handle search activation/deactivation
  useEffect(() => {
    if (!isMounted) return;

    if (isSearchActive) {
      // Fade out main view, fade in search view
      mainViewOpacity.value = withTiming(0, ANIMATION_CONFIG);
      searchViewOpacity.value = withTiming(1, ANIMATION_CONFIG);
      profileViewOpacity.value = withTiming(0, ANIMATION_CONFIG);
    } else {
      // Fade in main view, fade out search view
      mainViewOpacity.value = withTiming(1, ANIMATION_CONFIG);
      searchViewOpacity.value = withTiming(0, ANIMATION_CONFIG);
      // Don't change profile view here
    }
  }, [isSearchActive, isMounted]);

  // Handle friend profile view
  useEffect(() => {
    if (!isMounted) return;

    if (selectedFriend) {
      // Fade out main view, fade in profile view
      mainViewOpacity.value = withTiming(0, ANIMATION_CONFIG);
      profileViewOpacity.value = withTiming(1, ANIMATION_CONFIG);
      searchViewOpacity.value = withTiming(0, ANIMATION_CONFIG);
    } else {
      // Fade in main view, fade out profile view
      mainViewOpacity.value = withTiming(1, ANIMATION_CONFIG);
      profileViewOpacity.value = withTiming(0, ANIMATION_CONFIG);
      // Don't change search view here
    }
  }, [selectedFriend, isMounted]);

  // Simplify toggle view with no animations
  const toggleView = () => {
    console.log(
      "Toggling view from",
      activeView,
      "to",
      activeView === "friends" ? "saved" : "friends",
    );
    // Use InteractionManager to avoid UI thread blocking
    InteractionManager.runAfterInteractions(() => {
      // Simply toggle the view without animations
      setActiveView(activeView === "friends" ? "saved" : "friends");
    });
  };

  // Debounce timer ref for search
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestIdRef = useRef<number>(0);

  // Minimum search query length before sending API request
  const MIN_FRIEND_SEARCH_LENGTH = 2;
  const SEARCH_DEBOUNCE_DELAY = 800; // Wait 800ms after user stops typing

  // Handle search text change with debouncing and input validation
  const handleSearch = (text: string) => {
    // Update search query immediately for UI responsiveness
    setSearchQuery(text);

    // Clear previous debounce timer
    if (searchDebounceTimerRef.current) {
      clearTimeout(searchDebounceTimerRef.current);
      searchDebounceTimerRef.current = null;
    }

    // Trim the input to handle whitespace-only inputs
    const trimmedText = text.trim();

    // Handle empty or whitespace-only inputs
    if (!trimmedText || trimmedText.length === 0) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // If query is too short, clear results and don't search
    if (trimmedText.length < MIN_FRIEND_SEARCH_LENGTH) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // For valid queries, show loading state immediately during debounce period
    // This prevents the "nothing found" flash before loading spinner appears
    setIsSearching(true);
    setSearchResults([]); // Clear previous results while debouncing

    // Debounce the API call - only search after user stops typing
    searchDebounceTimerRef.current = setTimeout(async () => {
      // Increment request ID to prevent stale results
      const currentRequestId = ++searchRequestIdRef.current;

      try {
        // Use real API to search for users with trimmed query
        const searchResults = await api.searchUsers(trimmedText);

        // Only update if this is still the latest request
        if (currentRequestId === searchRequestIdRef.current) {
          // Convert search results to FriendItem format with real friend_status
          const searchUsersList: FriendItem[] = searchResults.map((user) => ({
            id: user.id,
            username: user.username,
            email: user.email,
            avatar_url: user.avatar_url,
            status: user.friend_status || "not_friend",
          }));

          setSearchResults(searchUsersList);
        } else {
          console.log(
            `Favorites - Ignoring stale search results (request ${currentRequestId} is not the latest ${searchRequestIdRef.current})`,
          );
        }
      } catch (error) {
        // Only update if this is still the latest request
        if (currentRequestId === searchRequestIdRef.current) {
          console.error("Error searching users:", error);
          setSearchResults([]);
          // Don't show alert for every error - only for unexpected ones
          if (
            error &&
            typeof error === "object" &&
            "status" in error &&
            error.status !== 401
          ) {
            Alert.alert("ошибка", "не удалось выполнить поиск пользователей");
          }
        }
      } finally {
        // Only update loading state if this is still the latest request
        if (currentRequestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_DELAY);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  // Toggle search mode
  const toggleSearch = () => {
    setIsSearchActive(!isSearchActive);
    if (!isSearchActive) {
      setSearchQuery("");
      setSearchResults([]); // Clear search results when exiting search
      // Clear any pending debounce timer
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
        searchDebounceTimerRef.current = null;
      }
      setIsSearching(false);
    }
  };

  // Handle friend selection
  const handleFriendSelect = (friend: FriendItem) => {
    console.log(`Friend selected: ${friend.username}`);
    setSelectedFriend(friend);
  };

  // Handle back from friend profile
  const handleBackFromProfile = () => {
    setSelectedFriend(null);
  };

  // Handle regenerate recommendations
  const handleRegenerateRecommendations = () => {
    // Only proceed if a friend is selected
    if (!selectedFriend) return;

    console.log("Regenerating recommendations for", selectedFriend.username);

    // Show loading indicator
    setIsRegenerating(true);

    // Simulate API call with a delay
    setTimeout(() => {
      // Generate new recommendations (in a real app, this would be from an API)
      const shuffledItems = [...customRecommendations[selectedFriend.id]];

      // Shuffle the array to simulate new recommendations
      for (let i = shuffledItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledItems[i], shuffledItems[j]] = [
          shuffledItems[j],
          shuffledItems[i],
        ];
      }

      // Add some randomness to the prices to make them look different
      const newRecommendations = shuffledItems.map((item: CardItem) => ({
        ...item,
        id: item.id + 1000, // Make sure IDs are unique
        price: Math.floor(Math.random() * 30 + 15) * 1000,
      }));

      // Update the recommendations
      setCustomRecommendations({
        ...customRecommendations,
        [selectedFriend.id]: newRecommendations,
      });

      // Hide loading indicator
      setIsRegenerating(false);
    }, 1000); // 1 second delay to simulate network request
  };

  // Improved navigation handler with animation cleanup - now with item data passing
  const handleNavigate = (
    screen: string,
    params?: any,
    fromFavorites: boolean = false,
  ) => {
    setIsMounted(false);
    const delay = 50;
    setTimeout(() => {
      if (fromFavorites && params && screen === "Home") {
        // Spread the entire item to preserve all fields including article_number
        const navigationParams = {
          addCardItem: {
            ...params, // Spread all fields to preserve article_number and other optional fields
          } as CardItem,
        };
        console.log("NAVIGATING TO HOME WITH PARAMS:", navigationParams);
        navigation.navigate(screen, navigationParams);
      } else if (screen === "Home") {
        console.log("NAVIGATING TO HOME WITHOUT PARAMS");
        navigation.navigate(screen);
      } else {
        console.log("NAVIGATING TO:", screen);
        navigation.navigate(screen);
      }
    }, delay);
  };

  // Helper functions to update local state efficiently
  const updateFriendItemStatus = (
    friendId: string,
    newStatus: FriendItem["status"],
    requestId?: string,
  ) => {
    setFriendItems((prev) =>
      prev.map((item) =>
        item.id === friendId
          ? {
              ...item,
              status: newStatus,
              requestId: requestId || item.requestId,
            }
          : item,
      ),
    );
  };

  const updateSearchItemStatus = (
    friendId: string,
    newStatus: FriendItem["status"],
    requestId?: string,
  ) => {
    setSearchResults((prev) =>
      prev.map((item) =>
        item.id === friendId
          ? {
              ...item,
              status: newStatus,
              requestId: requestId || item.requestId,
            }
          : item,
      ),
    );
  };

  const removeFriendFromLists = (friendId: string) => {
    setFriendItems((prev) => prev.filter((item) => item.id !== friendId));
    setSearchResults((prev) => prev.filter((item) => item.id !== friendId));
  };

  const addFriendToLists = (friend: FriendItem) => {
    setFriendItems((prev) => [...prev, friend]);
    setSearchResults((prev) =>
      prev.map((item) =>
        item.id === friend.id ? { ...item, status: "friend" as const } : item,
      ),
    );
  };

  // Real API functions for friend actions
  const acceptFriendRequest = async (requestId: string) => {
    console.log(`Accepting friend request ${requestId}...`);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      await api.acceptFriendRequest(requestId);

      // Find the friend item that was accepted
      const acceptedItem = friendItems.find(
        (item) => item.requestId === requestId,
      );
      if (acceptedItem) {
        // Update the item status to 'friend' and remove requestId
        updateFriendItemStatus(acceptedItem.id, "friend");
        updateSearchItemStatus(acceptedItem.id, "friend");
      }

      Alert.alert("успех", "заявка в друзья принята");
    } catch (error) {
      console.error("Error accepting friend request:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("ошибка", "не удалось принять заявку в друзья");
    }
  };

  const rejectFriendRequest = async (requestId: string) => {
    console.log(`Rejecting friend request ${requestId}...`);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      await api.rejectFriendRequest(requestId);

      // Find and remove the rejected request
      const rejectedItem = friendItems.find(
        (item) => item.requestId === requestId,
      );
      if (rejectedItem) {
        removeFriendFromLists(rejectedItem.id);
      }

      Alert.alert("успех", "заявка в друзья отклонена");
    } catch (error) {
      console.error("Error rejecting friend request:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("ошибка", "не удалось отклонить заявку в друзья");
    }
  };

  const sendFriendRequest = async (username: string) => {
    console.log(`Sending friend request to user ${username}...`);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const response = await api.sendFriendRequest(username);

      // Find the user in search results and update their status
      const searchItem = searchResults.find(
        (item) => item.username === username,
      );
      if (searchItem) {
        // Update the search item with the new status and request ID if available
        updateSearchItemStatus(
          searchItem.id,
          "request_sent",
          response.request_id,
        );

        // Add to main friends list so it shows when returning from search
        const newFriendItem: FriendItem = {
          id: searchItem.id,
          username: searchItem.username,
          email: searchItem.email,
          avatar_url: searchItem.avatar_url,
          status: "request_sent",
          requestId: response.request_id,
        };
        setFriendItems((prev) => [...prev, newFriendItem]);
      }

      Alert.alert("успех", "заявка в друзья отправлена");
    } catch (error) {
      console.error("Error sending friend request:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("ошибка", "не удалось отправить заявку в друзья");
    }
  };

  const cancelFriendRequest = async (requestId: string) => {
    console.log(`Cancelling friend request ${requestId}...`);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      await api.cancelFriendRequest(requestId);

      // Find the cancelled request and remove from main list, update search to not_friend
      const cancelledItem = friendItems.find(
        (item) => item.requestId === requestId,
      );
      if (cancelledItem) {
        // Remove from main friends list (they're no longer relevant there)
        setFriendItems((prev) =>
          prev.filter((item) => item.id !== cancelledItem.id),
        );
        // Update search results to show "not_friend" so user can re-add if desired
        updateSearchItemStatus(cancelledItem.id, "not_friend");
      }

      Alert.alert("успех", "заявка в друзья отменена");
    } catch (error) {
      console.error("Error cancelling friend request:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("ошибка", "не удалось отменить заявку в друзья");
    }
  };

  // Remove friend function (now uses real API endpoint)
  const removeFriend = async (friendId: string) => {
    console.log(`Removing friend ${friendId}...`);
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      // Use the real API endpoint
      await api.removeFriend(friendId);

      // Remove friend from both lists
      removeFriendFromLists(friendId);

      setMainShowConfirmDialog(false);
      setMainPendingRemoval(null);

      Alert.alert("успех", "друг удален из списка");
    } catch (error) {
      console.error("Error removing friend:", error);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("ошибка", "не удалось удалить друга");
    }
  };

  // 1. Move extra search users to state
  const [searchMockUsers, setSearchMockUsers] = useState<FriendItem[]>([
    {
      id: "search1",
      username: "searchuser1",
      email: "search1@example.com",
      status: "not_friend",
    },
    {
      id: "search2",
      username: "searchuser2",
      email: "search2@example.com",
      status: "not_friend",
    },
  ]);

  // 2. Update filteredFriends to only use search results from API
  // Only show results if query is valid (trimmed length >= 2)
  const trimmedQuery = searchQuery.trim();
  const hasValidQuery = trimmedQuery.length >= MIN_FRIEND_SEARCH_LENGTH;
  const filteredFriends = hasValidQuery ? searchResults : [];

  // Render a saved item
  const renderSavedItem: ListRenderItem<CardItem> = ({
    item,
    index,
    separators,
  }) => (
    <Animated.View
      entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD).delay(
        ANIMATION_DELAYS.STANDARD + index * ANIMATION_DELAYS.SMALL,
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
      style={styles.productItem}
    >
      <Pressable
        style={styles.productImageContainer}
        onPress={() => {
          console.log(`Saved item pressed: ${item.brand_name}`);
          handleNavigate("Home", item, true);
        }}
      >
        {item.images && item.images.length > 0 ? (
          <Image
            source={item.images[0]}
            style={styles.productItemImage}
            contentFit="contain"
          />
        ) : (
          <View
            style={[styles.productItemImage, styles.noProductImagePlaceholder]}
          >
            <Text style={styles.noProductImageText}>Нет изображения</Text>
          </View>
        )}
        <View style={styles.productItemInfo}>
          <Text style={styles.productItemName} numberOfLines={1}>
            {item.brand_name}
          </Text>
        </View>
        <PriceTag price={item.price} />
      </Pressable>
    </Animated.View>
  );

  // Replace renderFriendItem
  const renderFriendItem: ListRenderItem<FriendItem> = ({ item, index }) => {
    if (
      mainPendingRemoval &&
      mainShowConfirmDialog &&
      mainPendingRemoval.id === item.id
    ) {
      return (
        <View style={styles.itemWrapper}>
          <View style={styles.itemContainer}>
            <View style={styles.confirmationContainer}>
              <Text style={styles.confirmationText}>
                Подтвердить удаление из друзей?
              </Text>
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmYesButton]}
                  onPress={() => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    removeFriend(item.id);
                    setMainShowConfirmDialog(false);
                    setMainPendingRemoval(null);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Да</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmNoButton]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMainShowConfirmDialog(false);
                    setMainPendingRemoval(null);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Нет</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    }
    const handleAcceptRequest = async () => {
      if (item.status === "request_received" && item.requestId) {
        await acceptFriendRequest(item.requestId);
      }
    };
    const handleRejectRequest = async () => {
      if (item.status === "request_received" && item.requestId) {
        await rejectFriendRequest(item.requestId);
      }
    };
    return (
      <FriendListItem
        item={item}
        index={index}
        onAddFriend={() => sendFriendRequest(item.username)}
        onCancelRequest={() =>
          item.requestId && cancelFriendRequest(item.requestId)
        }
        onAcceptRequest={handleAcceptRequest}
        onRejectRequest={handleRejectRequest}
        onRemoveFriend={() => {
          setMainPendingRemoval(item);
          setMainShowConfirmDialog(true);
        }}
        onPress={() => {
          // Only allow viewing profile if user is an accepted friend
          if (item.status === "friend") {
            handleFriendSelect(item);
          }
        }}
        styles={styles}
        width={width}
      />
    );
  };

  // Render a recommended item - now accepts friend data for navigation
  const renderRecommendedItem =
    (
      friend: FriendItem,
      recommendedItems: CardItem[],
    ): ListRenderItem<CardItem> =>
    ({ item, index, separators }) => (
      <View style={styles.recommendationItemWrapper}>
        <View style={styles.itemContainer}>
          <Pressable
            style={styles.itemImageContainer}
            onPress={() => {
              console.log(`Recommended item pressed: ${item.brand_name}`);
              navigation.navigate("FriendRecommendations", {
                friendId: friend.id,
                friendUsername: friend.username,
                friendAvatarUrl: friend.avatar_url ?? undefined,
                initialItems: recommendedItems,
                clickedItemIndex: index,
              });
            }}
          >
            {item.images && item.images.length > 0 ? (
              <Image
                source={item.images[0]}
                style={styles.itemImage}
                contentFit="contain"
              />
            ) : (
              <View
                style={[styles.itemImage, styles.noProductImagePlaceholder]}
              >
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
        </View>
      </View>
    );

  // Custom render function for search results that includes user status
  const renderSearchUser: ListRenderItem<FriendItem> = ({
    item,
    index,
    separators,
  }) => {
    if (
      searchPendingRemoval &&
      searchShowConfirmDialog &&
      searchPendingRemoval.id === item.id
    ) {
      return (
        <View style={styles.searchItemWrapper}>
          <View style={styles.itemContainer}>
            <View style={styles.confirmationContainer}>
              <Text style={styles.confirmationText}>
                Подтвердить удаление из друзей?
              </Text>
              <View style={styles.confirmationButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmYesButton]}
                  onPress={() => {
                    Haptics.notificationAsync(
                      Haptics.NotificationFeedbackType.Success,
                    );
                    removeFriend(item.id);
                    setSearchShowConfirmDialog(false);
                    setSearchPendingRemoval(null);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Да</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.confirmNoButton]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSearchShowConfirmDialog(false);
                    setSearchPendingRemoval(null);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Нет</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      );
    }
    const handleAcceptRequest = async () => {
      if (item.status === "request_received" && item.requestId) {
        await acceptFriendRequest(item.requestId);
      }
    };

    const handleRejectRequest = async () => {
      if (item.status === "request_received" && item.requestId) {
        await rejectFriendRequest(item.requestId);
      }
    };

    const handleCancelRequest = async () => {
      // For search results, we need to find the requestId from sent requests
      if (item.status === "request_sent") {
        // First try to use the requestId if it's available in the search item
        if (item.requestId) {
          await cancelFriendRequest(item.requestId);
        } else {
          // Fall back to finding the request by username
          const sentRequest = sentRequests.find(
            (request) => request.recipient?.username === item.username,
          );
          if (sentRequest) {
            await cancelFriendRequest(sentRequest.id);
          } else {
            console.error("Could not find request ID for user:", item.username);
            Alert.alert("ошибка", "не удалось найти заявку для отмены");
          }
        }
      }
    };

    return (
      <View style={styles.searchItemWrapper}>
        <View style={styles.itemContainer}>
          <Pressable
            style={styles.userImageContainer}
            onPress={() => {
              // Only allow viewing profile if user is an accepted friend
              if (item.status === "friend") {
                console.log(`Friend item pressed: ${item.username}`);
                handleFriendSelect(item);
              }
            }}
            disabled={item.status !== "friend"}
          >
            <View style={styles.imageContainer}>
              <AvatarImage avatarUrl={item.avatar_url} size={width * 0.2} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                @{item.username}
              </Text>
            </View>
          </Pressable>
          {item.status === "friend" ? (
            <TouchableOpacity
              style={styles.removeFriendButton}
              onPress={() => {
                setSearchPendingRemoval(item);
                setSearchShowConfirmDialog(true);
              }}
            >
              <CancelThickIcon />
            </TouchableOpacity>
          ) : item.status === "request_received" ? (
            <View style={styles.stackedButtonsContainer}>
              <TouchableOpacity
                style={[styles.stackedButton, styles.acceptButton]}
                onPress={handleAcceptRequest}
              >
                <CheckIcon width={width * 0.1} height={width * 0.1} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.stackedButton, styles.rejectButton]}
                onPress={handleRejectRequest}
              >
                <CancelIcon width={width * 0.12} height={width * 0.12} />
              </TouchableOpacity>
            </View>
          ) : item.status === "not_friend" ? (
            <View style={styles.buttonContainerStyle}>
              <TouchableOpacity
                style={[styles.addFriendButton, styles.stackedButton]}
                onPress={() => sendFriendRequest(item.username)}
              >
                <PlusIcon />
              </TouchableOpacity>
            </View>
          ) : item.status === "request_sent" ? (
            <View style={styles.buttonContainerStyle}>
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
              >
                <TouchableOpacity
                  style={[
                    styles.stackedButton,
                    styles.rejectButton,
                    styles.cancelRequestButton,
                  ]}
                  onPress={handleCancelRequest}
                >
                  <Text style={styles.cancelRequestText}>Отменить заявку</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  // Handle press animation for bottom box
  const handleBottomBoxPressIn = () => {
    // Quick small scale down for press effect
    pressAnimationScale.value = withTiming(0.98, {
      duration: 100,
      easing: Easing.inOut(Easing.ease),
    });
  };

  const handleBottomBoxPressOut = () => {
    // Reset scale after press
    pressAnimationScale.value = withTiming(1, {
      duration: 100,
      easing: Easing.inOut(Easing.ease),
    });

    // Toggle the view without an explicit button
    toggleView();
  };

  // Get the recommendations for the selected friend, preferring custom recommendations if available
  const getRecommendationsForFriend = (friendId: string): RecommendedItem[] => {
    if (
      customRecommendations[friendId] &&
      customRecommendations[friendId].length > 0
    ) {
      return customRecommendations[friendId];
    }
    return [];
  };

  // Helper function to update user status in search results
  const setSearchUserStatus = (
    userId: string,
    status: FriendItem["status"],
  ) => {
    setSearchMockUsers((prev) =>
      prev.map((user) => (user.id === userId ? { ...user, status } : user)),
    );
  };

  const { height: screenHeight } = useWindowDimensions();
  const isSmallScreen = screenHeight < 700;

  if (!isMounted) return null;

  // Simplified render method - always render immediately for smooth transitions
  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
        ANIMATION_DELAYS.LARGE,
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      <>
        {/* Main Content (visible by default) */}
        <Animated.View style={mainViewAnimatedStyle}>
          <MainContent
            activeView={activeView}
            toggleSearch={toggleSearch}
            handleBottomBoxPressIn={handleBottomBoxPressIn}
            handleBottomBoxPressOut={handleBottomBoxPressOut}
            bottomBoxAnimatedStyle={bottomBoxAnimatedStyle}
            renderSavedItem={renderSavedItem}
            renderFriendItem={renderFriendItem}
            savedItems={savedItems}
            friendItems={friendItems}
            onAcceptRequest={acceptFriendRequest}
            onRejectRequest={rejectFriendRequest}
            handleNavigate={handleNavigate}
            isLoadingFriends={isLoadingFriends}
            isLoadingSaved={isLoadingSaved}
            isSmallScreen={isSmallScreen}
            screenHeight={screenHeight}
          />
        </Animated.View>

        {/* Search Content (hidden by default) */}
        <Animated.View style={searchViewAnimatedStyle}>
          <SearchContent
            searchQuery={searchQuery}
            handleSearch={handleSearch}
            toggleSearch={toggleSearch}
            filteredFriends={filteredFriends}
            renderSearchUser={renderSearchUser}
            onSendFriendRequest={sendFriendRequest}
            onRemoveFriend={(friendId) => {
              const friend = friendItems.find((f) => f.id === friendId);
              if (friend) {
                setSearchPendingRemoval(friend);
                setSearchShowConfirmDialog(true);
              }
            }}
            pendingRemoval={searchPendingRemoval}
            showConfirmDialog={searchShowConfirmDialog}
            setShowConfirmDialog={setSearchShowConfirmDialog}
            setPendingRemoval={setSearchPendingRemoval}
            removeFriend={removeFriend}
            hasValidQuery={hasValidQuery}
            trimmedQuery={trimmedQuery}
            isSearching={isSearching}
            minSearchLength={MIN_FRIEND_SEARCH_LENGTH}
            isSmallScreen={isSmallScreen}
            screenHeight={screenHeight}
          />
        </Animated.View>

        {/* Friend Profile View (hidden by default) */}
        <Animated.View style={profileViewAnimatedStyle}>
          {selectedFriend && (
            <FriendProfileView
              key={`friend-profile-${selectedFriend.id}`}
              friend={selectedFriend}
              onBack={handleBackFromProfile}
              recommendedItems={getRecommendationsForFriend(selectedFriend.id)}
              renderRecommendedItem={renderRecommendedItem(
                selectedFriend,
                getRecommendationsForFriend(selectedFriend.id),
              )}
              onRegenerate={handleRegenerateRecommendations}
              isRegenerating={isRegenerating}
              setCustomRecommendations={setCustomRecommendations}
              isLoadingFriendRecs={isLoadingFriendRecs[selectedFriend?.id]}
              setIsLoadingFriendRecs={setIsLoadingFriendRecs}
            />
          )}
        </Animated.View>
      </>
    </Animated.View>
  );
};

// Define the interfaces for our extracted components
interface MainContentProps {
  activeView: "friends" | "saved";
  toggleSearch: () => void;
  handleBottomBoxPressIn: () => void;
  handleBottomBoxPressOut: () => void;
  bottomBoxAnimatedStyle: any; // Added this line
  renderSavedItem: ListRenderItem<CardItem>;
  renderFriendItem: ListRenderItem<FriendItem>;
  savedItems: CardItem[];
  friendItems: FriendItem[];
  onAcceptRequest: (requestId: string) => void;
  onRejectRequest: (requestId: string) => void;
  handleNavigate: (
    screen: string,
    params?: any,
    fromFavorites?: boolean,
  ) => void;
  isLoadingFriends: boolean;
  isLoadingSaved: boolean;
  isSmallScreen?: boolean;
  screenHeight?: number;
}

interface BottomBoxContentProps {
  activeView: "friends" | "saved";
  handleBottomBoxPressIn: () => void;
  handleBottomBoxPressOut: () => void;
  renderSavedItem: ListRenderItem<CardItem>;
  renderFriendItem: ListRenderItem<FriendItem>;
  savedItems: CardItem[];
  friendItems: FriendItem[];
  handleNavigate: (
    screen: string,
    params?: any,
    fromFavorites?: boolean,
  ) => void;
}

interface SearchContentProps {
  searchQuery: string;
  handleSearch: (text: string) => void;
  toggleSearch: () => void;
  filteredFriends: FriendItem[];
  renderSearchUser: ListRenderItem<FriendItem>;
  onSendFriendRequest: (userId: string) => void;
  onRemoveFriend: (friendId: string) => void;
  pendingRemoval: FriendItem | null;
  showConfirmDialog: boolean;
  setShowConfirmDialog: (show: boolean) => void;
  setPendingRemoval: (friend: FriendItem | null) => void;
  removeFriend: (friendId: string) => void;
  hasValidQuery: boolean;
  trimmedQuery: string;
  isSearching: boolean;
  minSearchLength: number;
  isSmallScreen?: boolean;
  screenHeight?: number;
}

// Extracted component for main content to reduce render complexity
const MainContent = ({
  activeView,
  toggleSearch,
  handleBottomBoxPressIn,
  handleBottomBoxPressOut,
  bottomBoxAnimatedStyle,
  renderSavedItem,
  renderFriendItem,
  savedItems,
  friendItems,
  onAcceptRequest,
  onRejectRequest,
  handleNavigate,
  isLoadingFriends,
  isLoadingSaved,
  isSmallScreen = false,
  screenHeight,
}: MainContentProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  // Responsive box dimensions for iPhone SE and small screens
  const h = screenHeight ?? height;
  const topBoxStyle = isSmallScreen
    ? {
        height: h * 0.7,
        top: h * 0.025,
      }
    : undefined;
  const bottomBoxStyle = isSmallScreen
    ? {
        height: h * 0.8,
        top: h * 0.025,
      }
    : undefined;

  return (
    <>
      {/* Top Box (Friends by default) */}
      <Animated.View
        style={[
          styles.topBox,
          { backgroundColor: theme.surface.elevated },
          topBoxStyle,
        ]}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE,
        )}
        //exiting={FadeOutDown.duration(50)}
      >
        <View style={{ flex: 1, borderRadius: 41 }}>
          {activeView === "friends" && (
            <>
              {isLoadingFriends ? (
                <View style={[styles.flatList, { flex: 1 }]}>
                  <SkeletonGrid count={4} />
                </View>
              ) : friendItems.length === 0 ? (
                <View style={styles.mainEmptyStateContainer}>
                  <Text style={styles.mainEmptyStateText}>
                    пора добавить первого друга
                  </Text>
                </View>
              ) : (
                <FlatList<FriendItem>
                  style={styles.flatList}
                  data={friendItems}
                  renderItem={renderFriendItem}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  numColumns={2}
                  columnWrapperStyle={styles.columnWrapper}
                  contentContainerStyle={styles.listContent}
                  removeClippedSubviews={Platform.OS === "android"} // Optimize memory usage on Android
                  initialNumToRender={4} // Only render what's visible initially
                  maxToRenderPerBatch={4} // Limit batch size for smoother scrolling
                  windowSize={5} // Reduce window size for performance
                />
              )}
            </>
          )}

          {activeView === "saved" &&
            (isLoadingSaved ? (
              <View style={[styles.flatList, { flex: 1 }]}>
                <SkeletonGrid count={4} />
              </View>
            ) : savedItems.length === 0 ? (
              <View style={styles.mainEmptyStateContainer}>
                <Text style={styles.mainEmptyStateText}>пока тут пусто</Text>
              </View>
            ) : (
              <FlatList<FavoriteItem>
                style={styles.flatList}
                data={savedItems}
                renderItem={renderSavedItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                numColumns={2}
                columnWrapperStyle={styles.columnWrapper}
                contentContainerStyle={styles.listContent}
                removeClippedSubviews={Platform.OS === "android"} // Optimize memory usage on Android
                initialNumToRender={4} // Only render what's visible initially
                maxToRenderPerBatch={4} // Limit batch size for smoother scrolling
                windowSize={5} // Reduce window size for performance
              />
            ))}
          <View style={styles.titleRow}>
            <Text style={styles.boxTitle}>
              {activeView === "friends" ? "ДРУЗЬЯ" : "СОХРАНЁНКИ"}
            </Text>
            {activeView === "friends" && (
              <Pressable
                onPress={toggleSearch}
                style={styles.plusIconContainer}
              >
                <PlusSvg width={32} height={32} fill={theme.text.inverse} />
              </Pressable>
            )}
          </View>
        </View>
      </Animated.View>

      {/* Bottom Box (Saved by default) */}
      <Animated.View
        style={[
          styles.bottomBox,
          { backgroundColor: theme.background.favorites },
          bottomBoxStyle,
        ]}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.VERY_LARGE,
        )}
        //exiting={FadeOutDown.duration(50)}
      >
        <Animated.View
          style={[bottomBoxAnimatedStyle, { flex: 1, borderRadius: 41 }]}
        >
          <BottomBoxContent
            activeView={activeView}
            handleBottomBoxPressIn={handleBottomBoxPressIn}
            handleBottomBoxPressOut={handleBottomBoxPressOut}
            renderSavedItem={renderSavedItem}
            renderFriendItem={renderFriendItem}
            savedItems={savedItems}
            friendItems={friendItems}
            handleNavigate={handleNavigate}
          />
        </Animated.View>
      </Animated.View>
    </>
  );
};

// Extracted component for bottom box content to reduce render complexity
const BottomBoxContent = ({
  activeView,
  handleBottomBoxPressIn,
  handleBottomBoxPressOut,
  renderSavedItem,
  renderFriendItem,
  savedItems,
  friendItems,
  handleNavigate,
}: BottomBoxContentProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Pressable
      style={styles.bottomBoxContent}
      onPressIn={handleBottomBoxPressIn}
      onPressOut={handleBottomBoxPressOut}
    >
      <View style={styles.emptyStateContainer} />
      <Text style={styles.boxTitle}>
        {activeView === "friends" ? "СОХРАНЁНКИ" : "ДРУЗЬЯ"}
      </Text>
    </Pressable>
  );
};

// Extracted search content component
const SearchContent = ({
  searchQuery,
  handleSearch,
  toggleSearch,
  filteredFriends,
  renderSearchUser,
  onSendFriendRequest,
  onRemoveFriend,
  pendingRemoval,
  showConfirmDialog,
  setShowConfirmDialog,
  setPendingRemoval,
  removeFriend,
  hasValidQuery,
  trimmedQuery,
  isSearching,
  minSearchLength,
  isSmallScreen = false,
  screenHeight,
}: SearchContentProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const h = screenHeight ?? height;
  const searchResultsBoxStyle = isSmallScreen ? { height: h * 0.6 } : undefined;
  const searchModeTopBoxStyle = isSmallScreen ? { height: h * 0.7 } : undefined;

  return (
    <>
      {/* Search Input */}
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        style={styles.favoritesSearchContainer}
      >
        <View style={styles.favoritesSearchInputContainer}>
          <TextInput
            style={styles.favoritesSearchInput}
            placeholder="поиск"
            placeholderTextColor={theme.text.placeholderDark}
            value={searchQuery}
            onChangeText={handleSearch}
            autoFocus={true}
          />

          <Animated.View
            entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
            exiting={FadeOutDown.duration(ANIMATION_DURATIONS.QUICK)}
            style={styles.favoritesCancelButtonContainer}
          >
            <TouchableOpacity
              onPress={toggleSearch}
              style={styles.favoritesCancelButton}
            >
              <Text style={styles.favoritesCancelButtonText}>отмена</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>

      {/* Search Results */}
      <Animated.View
        style={[styles.searchResultsBox, searchResultsBoxStyle]}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MICRO).delay(
          ANIMATION_DELAYS.STANDARD,
        )}
        exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
      >
        <View style={{ flex: 1 }}>
          {!hasValidQuery ? (
            trimmedQuery.length === 0 ? (
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD,
                )}
                style={styles.emptyStateContainer}
              >
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.STANDARD)}
                  style={styles.emptyStateIcon}
                >
                  <AntDesign
                    name="search"
                    size={64}
                    color={theme.text.disabled}
                  />
                </Animated.View>
                <Animated.Text
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.MEDIUM)}
                  style={styles.emptyStateTitle}
                >
                  начните поиск
                </Animated.Text>
                <Animated.Text
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.LARGE)}
                  style={styles.emptyStateDescription}
                >
                  введите имя пользователя для поиска друзей
                </Animated.Text>
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD,
                )}
                style={styles.emptyStateContainer}
              >
                <Animated.Text
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.MEDIUM)}
                  style={styles.emptyStateDescription}
                >
                  введите минимум {minSearchLength} символа для поиска
                </Animated.Text>
              </Animated.View>
            )
          ) : isSearching ? (
            <View style={[styles.flatList, { flex: 1 }]}>
              <SkeletonGrid count={4} />
            </View>
          ) : filteredFriends.length === 0 ? (
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
                пользователи не найдены
              </Animated.Text>
              <Animated.Text
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.LARGE,
                )}
                style={styles.noResultsDescription}
              >
                попробуйте изменить поисковый запрос
              </Animated.Text>
            </Animated.View>
          ) : (
            <FlatList<FriendItem>
              style={styles.flatList}
              data={filteredFriends}
              renderItem={renderSearchUser}
              keyExtractor={(item) => item.id.toString()}
              showsVerticalScrollIndicator={false}
              numColumns={2}
              columnWrapperStyle={styles.columnWrapper}
              contentContainerStyle={styles.listContent}
              removeClippedSubviews={Platform.OS === "android"}
              initialNumToRender={4}
              maxToRenderPerBatch={4}
              windowSize={5}
            />
          )}
        </View>
      </Animated.View>

      {/* Shrunken Top Box - the box underneath search results */}
      <Animated.View
        style={[
          styles.topBox,
          styles.searchModeTopBox,
          { backgroundColor: theme.surface.elevated },
          searchModeTopBoxStyle,
        ]}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.SMALL,
        )}
        exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
      >
        <View style={styles.titleRow}>
          <Text style={styles.boxTitle}>ДРУЗЬЯ</Text>
          <Pressable onPress={toggleSearch} style={styles.plusIconContainer}>
            <PlusSvg width={24} height={24} fill={theme.text.inverse} />
          </Pressable>
        </View>
      </Animated.View>
    </>
  );
};

// Define interface for Friend Profile View props
interface FriendProfileViewProps {
  friend: FriendItem;
  onBack: () => void;
  recommendedItems: CardItem[];
  renderRecommendedItem: ListRenderItem<CardItem>;
  onRegenerate: () => void;
  isRegenerating: boolean;
  setCustomRecommendations: React.Dispatch<
    React.SetStateAction<{ [key: string]: CardItem[] }>
  >;
  isLoadingFriendRecs: boolean;
  setIsLoadingFriendRecs: React.Dispatch<
    React.SetStateAction<{ [key: string]: boolean }>
  >;
}

// Friend Profile View Component
const FriendProfileView = React.memo(
  ({
    friend,
    onBack,
    recommendedItems,
    renderRecommendedItem,
    onRegenerate,
    isRegenerating,
    setCustomRecommendations,
    isLoadingFriendRecs,
    setIsLoadingFriendRecs,
  }: FriendProfileViewProps) => {
    const { theme } = useTheme();
    const styles = useMemo(() => createStyles(theme), [theme]);

    // Track whether recommendations have been regenerated for animation purposes
    const [isNewRecommendation, setIsNewRecommendation] = useState(false);

    // Store the recommendedItems in a ref to avoid unnecessary effect triggers
    const prevItemsRef = useRef<CardItem[]>([]);

    // State for friend's public profile
    const [friendProfile, setFriendProfile] =
      useState<api.PublicUserProfile | null>(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);

    // Animated values for button spinning effect
    const [isSpinning, setIsSpinning] = useState(false);
    const borderSpinValue = useRef(new RNAnimated.Value(0)).current;
    const buttonScaleValue = useRef(new RNAnimated.Value(1)).current;

    // Map 0-1 animation value to a full 720 degree rotation (two spins)
    const borderSpin = borderSpinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "720deg"],
    });

    // Check if user is actually a friend - kick them out if not
    useEffect(() => {
      if (friend.status !== "friend") {
        console.log("User is not a friend, redirecting back");
        onBack();
      }
    }, [friend.status, onBack]);

    // Load friend's public profile when component mounts
    useEffect(() => {
      const loadFriendProfile = async () => {
        try {
          setIsLoadingProfile(true);
          setProfileError(null);

          const profile = await api.getUserPublicProfile(friend.id);
          setFriendProfile(profile);
          console.log("Loaded friend profile:", profile);
        } catch (error) {
          console.error("Error loading friend profile:", error);
          setProfileError("не удалось загрузить профиль пользователя");
        } finally {
          setIsLoadingProfile(false);
        }
      };

      if (friend.id && friend.status === "friend") {
        loadFriendProfile();
      }
    }, [friend.id, friend.status]);

    // Handle regenerate button press with spinning border animation
    const handleRegeneratePress = () => {
      if (isSpinning || isRegenerating) return; // Prevent multiple presses during animation

      // Start spinning and regeneration process immediately
      setIsSpinning(true);

      // Start regeneration process immediately rather than waiting for animation to complete
      onRegenerate();

      // Reset spin value to 0
      borderSpinValue.setValue(0);

      // Create scale down/up sequence with spinning border
      RNAnimated.sequence([
        // Scale down button slightly
        RNAnimated.timing(buttonScaleValue, {
          toValue: 0.95,
          duration: 150,
          useNativeDriver: true,
          easing: RNEasing.out(RNEasing.cubic),
        }),
        // Spin border with acceleration and deceleration
        RNAnimated.timing(borderSpinValue, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
          easing: RNEasing.inOut(RNEasing.cubic), // Accelerate and decelerate smoothly
        }),
        // Scale back up
        RNAnimated.timing(buttonScaleValue, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
          easing: RNEasing.out(RNEasing.cubic),
        }),
      ]).start(() => {
        // Animation completed - just clear spinning flag
        // but don't trigger onRegenerate again as we've already called it
        setIsSpinning(false);
      });
    };

    // Reset the new recommendation flag when items change
    useEffect(() => {
      // Only trigger the animation when items actually change (not on initial render)
      const itemsChanged =
        prevItemsRef.current.length > 0 &&
        JSON.stringify(prevItemsRef.current) !==
          JSON.stringify(recommendedItems);

      if (recommendedItems.length > 0 && itemsChanged) {
        setIsNewRecommendation(true);

        // Reset the flag after animation duration
        const timer = setTimeout(() => {
          setIsNewRecommendation(false);
        }, 1500);

        // Update the ref
        prevItemsRef.current = [...recommendedItems];

        return () => clearTimeout(timer);
      } else if (recommendedItems.length > 0) {
        // Initial store
        prevItemsRef.current = [...recommendedItems];
      }
    }, [recommendedItems]);

    // Create a memoized render function to avoid unnecessary re-renders
    const renderItem = React.useCallback(renderRecommendedItem, [
      renderRecommendedItem,
    ]); // renderRecommendedItem already returns a ListRenderItem function

    // In FriendProfileView, fetch recommendations from the real API
    useEffect(() => {
      const loadFriendRecommendations = async () => {
        if (!friend.id) return;
        try {
          setIsLoadingFriendRecs((prev) => ({ ...prev, [friend.id]: true }));
          const recs = await apiWrapper.getFriendRecommendations(
            friend.id,
            "FavoritesPage",
          );
          // Use utility function to ensure consistent mapping with article_number preservation
          const recommendedItems = (recs || []).map(
            (item: api.Product, index: number) =>
              mapProductToCardItem(item, index),
          );
          setCustomRecommendations(
            (prev: { [key: string]: RecommendedItem[] }) => ({
              ...prev,
              [friend.id]: recommendedItems,
            }),
          );
        } catch (error: any) {
          console.error("Error loading friend recommendations:", error);
          setCustomRecommendations(
            (prev: { [key: string]: RecommendedItem[] }) => ({
              ...prev,
              [friend.id]: [],
            }),
          );

          // Show appropriate error message based on error type
          if (error.status === 401) {
            // Don't show alert for authentication errors, just log them
            console.log("Authentication error loading friend recommendations");
          } else if (error.status === 404) {
            Alert.alert("ошибка", "друг не найден");
          } else if (error.status >= 500) {
            Alert.alert("ошибка", "проблема с сервером. попробуйте позже");
          } else {
            Alert.alert(
              "ошибка",
              "не удалось загрузить рекомендации для друга",
            );
          }
        } finally {
          setIsLoadingFriendRecs((prev) => ({ ...prev, [friend.id]: false }));
        }
      };
      loadFriendRecommendations();
    }, [friend.id, setCustomRecommendations]);

    return (
      <Animated.View
        style={styles.profileContainer}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
      >
        {/* Header with back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
        >
          <BackIcon width={22} height={22} />
        </TouchableOpacity>

        {/* Profile info */}
        <View style={styles.profileInfo}>
          <View style={styles.profileImageContainer}>
            <AvatarImage
              avatarUrl={friend.avatar_url ?? friendProfile?.avatar_url}
              size={width * 0.25}
            />
          </View>
        </View>

        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.SMALL,
          )}
          style={styles.regenerateButtonWrapper}
        >
          {/* Container for the button - this stays still */}
          <View style={styles.regenerateButtonContainer}>
            {/* Spinning border gradient */}
            <RNAnimated.View
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                borderRadius: 30,
                transform: [{ rotate: borderSpin }],
              }}
            >
              <LinearGradient
                colors={
                  theme.gradients.regenerateButtonBorder as [
                    string,
                    string,
                    string,
                  ]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.regenerateButtonBorder}
              />
            </RNAnimated.View>

            {/* Button itself - scales but doesn't spin */}
            <RNAnimated.View
              style={{
                width: "100%",
                height: "100%",
                padding: 3, // Match border thickness
                transform: [{ scale: buttonScaleValue }],
              }}
            >
              <TouchableOpacity
                onPress={handleRegeneratePress}
                disabled={isSpinning || isRegenerating}
                style={styles.pressableContainer}
              >
                <LinearGradient
                  colors={
                    theme.gradients.regenerateButton as [string, string, string]
                  }
                  locations={[0.15, 0.56, 1]}
                  start={{ x: 0.48, y: 1 }}
                  end={{ x: 0.52, y: 0 }}
                  style={styles.regenerateButtonGradient}
                >
                  <Text style={styles.regenerateButtonText}>
                    {isRegenerating || isSpinning
                      ? "загрузка..."
                      : "сделать ai подборку"}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </RNAnimated.View>
          </View>
        </Animated.View>

        <Animated.View
          style={styles.roundedBox}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
            ANIMATION_DELAYS.STANDARD,
          )}
          exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
        >
          <LinearGradient
            colors={theme.gradients.overlay as any}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0.3 }}
            locations={theme.gradients.overlayLocations as any}
            style={styles.gradientBackground}
          />
          {/* Recommendations section */}
          <Animated.View
            style={styles.recommendationsContainer}
            entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
              ANIMATION_DELAYS.MEDIUM,
            )}
          >
            {isRegenerating ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>
                  подбираем новые рекомендации...
                </Text>
              </View>
            ) : isLoadingFriendRecs ? (
              <View style={[styles.recommendationsList, { flex: 1 }]}>
                <SkeletonGrid count={4} />
              </View>
            ) : (
              <FlatList<RecommendedItem>
                style={styles.recommendationsList}
                data={recommendedItems}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                numColumns={2}
                columnWrapperStyle={styles.recommendationsColumnWrapper}
                contentContainerStyle={styles.listContent}
                removeClippedSubviews={Platform.OS === "android"}
                initialNumToRender={4}
                maxToRenderPerBatch={4}
                windowSize={5}
              />
            )}
          </Animated.View>
          <Animated.View style={styles.textContainer}>
            <Text style={styles.text}>
              {isLoadingProfile
                ? "загрузка..."
                : profileError
                  ? friend.username
                  : friendProfile?.username || friend.username}
            </Text>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  },
);

// Friend Request Item Component
interface FriendRequestItemProps {
  request: FriendRequestItem;
  onAccept: (requestId: string) => void;
  onReject: (requestId: string) => void;
}

const FriendRequestItemComponent: React.FC<FriendRequestItemProps> = ({
  request,
  onAccept,
  onReject,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.requestItemWrapper}>
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD)}
      >
        <View style={styles.requestItemContainer}>
          <View style={styles.requestImageContainer}>
            <AvatarImage
              avatarUrl={(request as { avatar_url?: string | null }).avatar_url}
              size={40}
            />
            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                @{request.username}
              </Text>
            </View>
          </View>
          <View style={styles.requestButtonsContainer}>
            <TouchableOpacity
              style={[styles.requestButton, styles.acceptButton]}
              onPress={() => onAccept(request.requestId)}
            >
              <Text style={styles.requestButtonText}>Принять</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.requestButton, styles.rejectButton]}
              onPress={() => onReject(request.requestId)}
            >
              <Text style={styles.requestButtonText}>Отклонить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
      width: "100%",
      height: "100%",
      //backgroundColor: '#FFFFFF', // Add background color
    },
    absoluteFill: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: "flex-start",
      alignItems: "center",
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
    topBox: {
      position: "absolute",
      zIndex: 5,
      width: "88%",
      height: Platform.OS === "ios" ? height * 0.67 : height * 0.66,
      left: "6%",
      top: Platform.OS === "ios" ? height * 0.035 : height * 0.052,
      borderRadius: 41,
      //padding: 15,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    flatList: {
      width: "100%",
      height: "100%",
      padding: 21, // 1.5:1 ratio with inner spacing (14 * 1.5)
      borderRadius: 41,
    },
    searchModeTopBox: {
      height: height * 0.65,
      top: Platform.OS === "ios" ? height * 0.145 : height * 0.166,
      //bottom: Platform.OS === 'ios' ? height*0.0 : '2%',
      zIndex: 1, // Lower z-index to position behind search results
      justifyContent: "flex-end",
    },
    bottomBox: {
      position: "absolute",
      width: "88%",
      height: height * 0.75,
      left: "6%",
      top: Platform.OS === "ios" ? height * 0.035 : height * 0.052,
      borderRadius: 41,
      padding: 15,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
      zIndex: 2,
      overflow: "hidden",
    },
    searchModeBottomBox: {
      height: height * 0.65,
      bottom: Platform.OS === "ios" ? height * 0.02 : height * 0.035,
      zIndex: 1, // Lower z-index in search mode
    },
    bottomBoxContent: {
      width: "100%",
      height: "100%",
      overflow: "hidden",
    },
    titleRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 15,
    },
    boxTitle: {
      fontFamily: "IgraSans",
      fontSize: 38,
      color: theme.text.inverse,
      marginTop: 5,
      marginLeft: 10,
      textAlign: "left",
    },
    plusIconContainer: {
      padding: 5,
      marginBottom: Platform.OS === "ios" ? 0 : -10,
    },
    listContent: {
      paddingBottom: 20,
    },
    previewListContent: {
      paddingBottom: 10,
    },
    columnWrapper: {
      justifyContent: "space-between",
      paddingHorizontal: 0, // Match recommendations: outer padding handles spacing
      marginBottom: 14, // Vertical spacing to match horizontal spacing (14px gap)
    },
    itemContainer: {
      height: (width * 0.88 - 45) / 2,
      width: "100%", // Calculate width for two columns with spacing
      marginBottom: 0, // Reduced to match horizontal spacing (handled by columnWrapper gap)
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
      backgroundColor: theme.surface.item,
      borderRadius: 30,
      position: "relative", // For absolute positioned elements
      justifyContent: "center", // Center vertically
      alignItems: "center", // Center horizontally
      flexDirection: "row",
    },
    searchItem: {
      width: "100%",
      marginBottom: 17,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
      backgroundColor: theme.surface.item,
      borderRadius: 30,
      position: "relative", // For absolute positioned elements
      flexDirection: "row",
      justifyContent: "center", // Center vertically
      alignItems: "center", // Center horizontally
    },
    userImageContainer: {
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
    },
    itemImageContainer: {
      overflow: "hidden",
      aspectRatio: 1,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 30,
      padding: 5,
      height: "100%",
      width: "100%",
    },
    imageContainer: {
      overflow: "hidden",
      aspectRatio: 1,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 30,
      width: width * 0.2,
      height: width * 0.2,
      //backgroundColor: '#EDE7E2',
    },
    itemImage: {
      width: "73%",
      height: "73%",
    },
    userImage: {
      height: "100%",
      width: "100%",
      borderRadius: width * 0.2,
    },
    userInfo: {
      alignItems: "center",
      padding: 6,
      position: "absolute",
      bottom: 10,
    },
    itemInfo: {
      alignItems: "center",
      padding: 6,
    },
    itemName: {
      fontFamily: "IgraSans",
      fontSize: 13,
      color: theme.text.secondary,
      textAlign: "center",
      bottom: -5,
    },
    // Product item styles matching Search.tsx
    productItem: {
      width: (width * 0.88 - 42 - 14) / 2, // Container width - list padding (42 = 21*2) - gap (14, 1.5:1 ratio)
      marginBottom: 0, // Vertical spacing handled by columnWrapper to match horizontal spacing
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
      backgroundColor: theme.surface.item,
      borderRadius: 30,
    },
    productImageContainer: {
      overflow: "hidden",
      aspectRatio: 1,
      position: "relative",
      alignItems: "center",
      justifyContent: "center",
    },
    productItemImage: {
      width: "73%",
      height: "73%",
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
    productItemInfo: {
      bottom: -5,
      alignItems: "center",
      borderRadius: 20,
      padding: 6,
    },
    productItemName: {
      fontFamily: "IgraSans",
      fontSize: 13,
      color: theme.text.secondary,
      textAlign: "center",
      paddingHorizontal: 10,
    },
    favoritesSearchContainer: {
      position: "absolute",
      width: "88%",
      left: "6%",
      height: height * 0.1,
      zIndex: 10,
      top: Platform.OS === "ios" ? height * 0.02 : height * 0.04,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
      backgroundColor: theme.background.primary,
      borderRadius: 41,
      overflow: "hidden",
    },
    favoritesSearchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      height: "100%",
      paddingHorizontal: 15,
    },
    favoritesSearchInput: {
      fontSize: 30,
      fontFamily: "IgraSans",
      flex: 1,
      height: "100%",
      paddingVertical: 10,
      color: theme.text.primary,
    },
    favoritesCancelButtonContainer: {
      marginRight: -16,
    },
    favoritesCancelButton: {
      paddingHorizontal: Platform.OS === "ios" ? 45 : 50,
      backgroundColor: theme.button.cancel,
      borderRadius: 41,
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
    },
    favoritesCancelButtonText: {
      fontFamily: "IgraSans",
      fontSize: 18,
      color: theme.button.primary,
    },
    searchResultsBox: {
      position: "absolute",
      left: "6%",
      top: Platform.OS === "ios" ? height * 0.145 : height * 0.166,
      zIndex: 8,
      width: "88%",
      height: Platform.OS === "ios" ? height * 0.57 : height * 0.56,
      borderRadius: 41,
      //padding: 15,
      backgroundColor: theme.background.primary,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
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
    itemWrapper: {
      width: (width * 0.88 - 42 - 14) / 2, // Container width - list padding (42 = 21*2) - gap (14, 1.5:1 ratio)
      marginBottom: 0, // Vertical spacing matches horizontal spacing (handled by columnWrapper)
    },
    searchItemWrapper: {
      width: "47%",
      //marginBottom: 17,
    },
    usernameContainer: {
      position: "absolute",
      right: -25,
      top: "50%",
      transform: [{ translateY: -20 }, { rotate: "90deg" }],
      borderRadius: 10,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    usernameText: {
      fontFamily: "REM",
      fontSize: 14,
      color: theme.text.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    toggleButton: {
      position: "absolute",
      top: Platform.OS === "ios" ? height * 0.02 : height * 0.04,
      right: 10,
      padding: 10,
      backgroundColor: theme.button.secondary,
      borderRadius: 41,
    },
    toggleButtonText: {
      fontFamily: "IgraSans",
      fontSize: 18,
      color: theme.text.inverse,
    },
    // Friend Profile styles
    profileContainer: {
      width: "88%",
      height: "92%",
      backgroundColor: "transparent",
      justifyContent: "center",
      alignItems: "center",
    },
    backButton: {
      position: "absolute",
      top: 0,
      left: 10,
      zIndex: 10,
      width: 33,
      height: 33,
    },
    profileInfo: {
      alignItems: "center",
      marginBottom: 25,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    profileImageContainer: {
      width: width * 0.3,
      height: width * 0.3,
      borderRadius: width * 0.15,
      overflow: "hidden",
      backgroundColor: theme.surface.item,
      alignItems: "center",
      justifyContent: "center",
    },
    profileImage: {
      width: "75%",
      height: "75%",
      borderRadius: width * 0.1125,
    },
    roundedBox: {
      width: "100%",
      height: width * 1.06,
      borderRadius: 41,
      backgroundColor: theme.primary + "00",
      position: "relative",
      borderWidth: 3,
      borderColor: theme.primary + "66",
    },
    gradientBackground: {
      borderRadius: 37,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    recommendationsContainer: {
      backgroundColor: theme.background.primary,
      borderRadius: 41,
      width: width * 0.88,
      height: width * 0.88,
      top: -3,
      left: -3,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    recommendationsList: {
      flex: 1,
      borderRadius: 41,
      padding: 21, // 1.5:1 ratio with inner spacing (14 * 1.5)
      //paddingTop: 17.5,
    },
    recommendationsColumnWrapper: {
      justifyContent: "space-between",
      paddingHorizontal: 0,
      marginBottom: 14, // Vertical spacing to match horizontal spacing (14px gap)
    },
    recommendationItemWrapper: {
      width: (width * 0.88 - 42 - 14) / 2, // Container width - list padding (42 = 21*2) - gap (14, 1.5:1 ratio)
    },
    regenerateButtonWrapper: {
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      marginBottom: 20,
    },
    regenerateButtonContainer: {
      width: 280, // Fixed width to ensure consistent size
      height: 65, // Fixed height for the button
      borderRadius: 30,
      overflow: "hidden",
      ...Platform.select({
        android: {
          elevation: 8,
        },
      }),
      position: "relative",
    },
    regenerateButtonBorder: {
      flex: 1,
      borderRadius: 30,
      zIndex: 5,
    },
    pressableContainer: {
      width: "100%",
      height: "100%",
      borderRadius: 27,
      overflow: "hidden",
    },
    regenerateButtonGradient: {
      flex: 1,
      borderRadius: 27, // Slightly smaller to create border effect
      alignItems: "center",
      justifyContent: "center",
      zIndex: 10,
      overflow: "hidden",
    },
    regenerateButtonText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.inverse,
    },
    regenerateButtonDisabled: {
      backgroundColor: theme.surface.selection,
      opacity: 0.8,
    },
    textContainer: {
      position: "absolute",
      bottom: 0,
      marginBottom: 18,
      marginLeft: 15,
    },
    text: {
      fontFamily: "IgraSans",
      fontSize: 38,
      color: theme.text.inverse,
    },
    requestItemWrapper: {
      width: "100%",
      padding: 10,
    },
    requestItemContainer: {
      flexDirection: "row",
      alignItems: "center",
    },
    requestImageContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: "hidden",
      marginRight: 10,
    },
    requestButtonsContainer: {
      flexDirection: "row",
    },
    requestButton: {
      padding: 10,
      borderRadius: 20,
      backgroundColor: theme.button.secondary,
      marginHorizontal: 5,
    },
    acceptButton: {
      backgroundColor: theme.interactive.accept,
    },
    rejectButton: {
      backgroundColor: theme.interactive.reject,
    },
    requestButtonText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.inverse,
    },
    confirmationContainer: {
      height: "88%",
      width: "88%",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 14,
      backgroundColor: theme.status.error,
      borderRadius: 30,
    },
    confirmationText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.secondary,
      lineHeight: 20,
      opacity: 0.8,
      textAlign: "center",
    },
    confirmationButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    confirmButton: {
      padding: 10,
      width: "50%",
      justifyContent: "center",
      alignItems: "center",
      borderRadius: 20,
      backgroundColor: theme.button.secondary,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 6,
    },
    confirmYesButton: {
      backgroundColor: theme.status.error,
    },
    confirmNoButton: {
      backgroundColor: theme.interactive.inactive,
    },
    confirmButtonText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.secondary,
      opacity: 0.8,
    },
    removeFriendButton: {
      position: "absolute",
      top: 10,
      right: 10,
      padding: 2.5,
      backgroundColor: theme.interactive.remove,
      borderRadius: 20,
    },
    removeFriendButtonText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.inverse,
    },
    sectionTitle: {
      fontFamily: "IgraSans",
      fontSize: 24,
      color: theme.text.secondary,
      marginBottom: 10,
    },
    miniRequestButtons: {
      flexDirection: "row",
      alignItems: "center",
    },
    miniRequestButton: {
      padding: 5,
      borderRadius: 20,
      backgroundColor: theme.button.secondary,
      marginHorizontal: 5,
    },
    miniAcceptButton: {
      backgroundColor: theme.social.acceptLight,
    },
    miniRejectButton: {
      backgroundColor: theme.social.rejectLight,
    },
    miniRequestButtonText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.inverse,
    },
    pendingRequestBadge: {
      padding: 5,
      borderRadius: 20,
      backgroundColor: theme.button.secondary,
      marginLeft: 10,
    },
    pendingRequestText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.inverse,
    },
    addFriendButton: {
      padding: 5,
      borderRadius: 20,
      //marginLeft: 10,
    },
    addFriendButtonText: {
      fontFamily: "IgraSans",
      fontSize: 15,
      color: theme.text.inverse,
    },
    cancelRequestButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 3,
      width: width * 0.15,
      height: width * 0.15,
    },
    cancelRequestText: {
      color: theme.text.secondary,
      fontFamily: "IgraSans",
      fontSize: 10,
      textAlign: "center",
    },
    stackedButtonsContainer: {
      position: "relative",
      marginLeft: 5,
      flexDirection: "column",
      gap: 10,
      //right: 15,
      justifyContent: "center",
      alignItems: "center",
    },
    stackedButton: {
      width: width * 0.12,
      height: width * 0.12,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 3,
    },
    stackedButtonText: {
      fontFamily: "IgraSans",
      fontSize: 18,
      color: theme.text.inverse,
    },
    confirmationOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.modal.backdrop,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    buttonContainerStyle: {
      width: width * 0.15,
      height: width * 0.15,
      justifyContent: "center",
      alignItems: "center",
    },
    mainEmptyStateContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    mainEmptyStateText: {
      fontFamily: "IgraSans",
      fontSize: 32,
      color: theme.text.inverse,
      textAlign: "center",
    },
  });

// Add above Favorites component
interface FriendListItemProps {
  item: FriendItem;
  index: number;
  onAddFriend?: () => void;
  onCancelRequest?: () => void;
  onAcceptRequest?: () => void;
  onRejectRequest?: () => void;
  onRemoveFriend?: () => void;
  onPress?: () => void;
  styles: any;
  width: number;
}

const FriendListItem = memo(
  ({
    item,
    index,
    onAddFriend,
    onCancelRequest,
    onAcceptRequest,
    onRejectRequest,
    onRemoveFriend,
    onPress,
    styles,
    width,
  }: FriendListItemProps) => {
    console.log("FriendListItem rendering with item:", item);

    return (
      <View style={styles.itemWrapper}>
        <Animated.View
          entering={FadeInDown.duration(ANIMATION_DURATIONS.STANDARD).delay(
            ANIMATION_DELAYS.STANDARD + index * ANIMATION_DELAYS.SMALL,
          )}
          exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
        >
          <View style={styles.itemContainer}>
            <Pressable
              style={styles.userImageContainer}
              onPress={onPress}
              disabled={item.status !== "friend"}
            >
              <View style={styles.imageContainer}>
                <AvatarImage avatarUrl={item.avatar_url} size={width * 0.2} />
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
            </Pressable>
            <UserActionButton
              status={item.status}
              onAddFriend={onAddFriend}
              onCancelRequest={onCancelRequest}
              onAcceptRequest={onAcceptRequest}
              onRejectRequest={onRejectRequest}
              onRemoveFriend={onRemoveFriend}
              styles={styles}
              width={width}
            />
          </View>
        </Animated.View>
      </View>
    );
  },
);

// Now update renderFriendItem and renderSearchUser to use FriendListItem

export default Favorites;
