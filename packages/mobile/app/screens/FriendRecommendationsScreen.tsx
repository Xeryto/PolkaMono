import React, { useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  Dimensions,
  Platform,
  Animated as RNAnimated,
  Alert,
} from "react-native";
import { TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeInDown,
  FadeOutDown,
} from "react-native-reanimated";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
} from "../lib/animations";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

import BackIcon from "../components/svg/BackIcon";
import * as api from "../services/api";
import { apiWrapper } from "../services/apiWrapper";
import AvatarImage from "../components/AvatarImage";
import { CardItem, CartItem } from "../types/product";
import { mapProductToCardItem } from "../lib/productMapper";
import { getEffectivePrice, formatPrice } from "../lib/swipeCardUtils";
import {
  SwipeCard,
  CardFront,
  CardBack,
  createSwipeCardStyles,
} from "../components/swipeCard";
import { useSwipeDeck } from "../hooks/useSwipeDeck";

interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  addListener?: (event: string, callback: () => void) => () => void;
  setParams?: (params: any) => void;
}

interface FriendRecommendationsScreenProps {
  navigation: SimpleNavigation;
  route?: {
    params?: {
      friendId: string;
      friendUsername: string;
      friendAvatarUrl?: string | null;
      initialItems: CardItem[];
      clickedItemIndex: number;
    };
  };
}

const height = Dimensions.get("window").height;
const width = Dimensions.get("window").width;

const FriendRecommendationsScreen = ({
  navigation,
  route,
}: FriendRecommendationsScreenProps) => {
  const { theme } = useTheme();
  const cardStyles = useMemo(() => createSwipeCardStyles(theme, 35), [theme]);
  const styles = useMemo(() => createScreenStyles(theme), [theme]);

  const friendId = route?.params?.friendId || "";
  const friendUsername = route?.params?.friendUsername || "";
  const friendAvatarUrl = route?.params?.friendAvatarUrl ?? undefined;
  const initialItems = route?.params?.initialItems || [];
  const clickedItemIndex = route?.params?.clickedItemIndex || 0;

  const fetchMoreFriendCards = async (count: number = 2): Promise<CardItem[]> => {
    try {
      const products = await apiWrapper.getFriendRecommendations(friendId, "FRS");
      if (!products || !Array.isArray(products)) return [];
      return products.slice(0, count).map((p: api.Product, i: number) => mapProductToCardItem(p, i));
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes("invalid token")) {
        Alert.alert("сессия истекла", "пожалуйста, войдите в аккаунт снова.");
        return [];
      }
      console.error("Error fetching friend recommendations:", error);
      return [];
    }
  };

  const deck = useSwipeDeck({
    cardWidthFraction: 0.80,
    fetchCards: fetchMoreFriendCards,
    onAddToCart: (card, size, variantId) => {
      const cartItem: CartItem = {
        ...card,
        size,
        quantity: 1,
        delivery: { cost: 0, estimatedTime: "" },
        product_variant_id: variantId,
      };
      if (typeof global.cartStorage !== "undefined") {
        global.cartStorage.addItem(cartItem);
        if (Platform.OS === "ios") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        navigation.navigate("Cart");
      }
    },
    initialCards: initialItems.slice(clickedItemIndex),
  });

  const renderEmptyState = () => (
    <View style={[cardStyles.whiteBox, cardStyles.noCardsContainer]}>
      <Text style={cardStyles.noCardsText}>Загрузка новых карточек...</Text>
      <Text style={cardStyles.noCardsSubtext}>Пожалуйста, подождите</Text>
    </View>
  );

  const currentCard = deck.cards[deck.currentCardIndex];
  const hasSale = currentCard?.sale_price != null && currentCard.sale_price > 0;
  const displaySalePrice = hasSale ? getEffectivePrice(currentCard!) : null;

  return (
    <Animated.View
      style={styles.container}
      entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(ANIMATION_DELAYS.LARGE)}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      {/* Friend Header */}
      <View style={styles.friendHeader}>
        <View style={styles.friendInfoContainer}>
          <View style={styles.backButtonContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate("Favorites")}
              activeOpacity={0.7}
            >
              <BackIcon width={22} height={22} />
            </TouchableOpacity>
          </View>
          <View style={styles.friendUsernameShadowWrapper}>
            <View style={styles.friendUsernameWrapper}>
              <LinearGradient
                colors={theme.gradients.friendUsername as any}
                locations={[0, 0.4, 1]}
                start={{ x: 0.25, y: 0 }}
                end={{ x: 0.6, y: 1.5 }}
                style={styles.friendUsernameBorder}
              />
              <View style={styles.friendUsernameInnerWrapper}>
                <View style={styles.friendUsernameContainer}>
                  <Text style={styles.friendUsername}>{friendUsername}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.friendIconContainer}>
            <AvatarImage
              avatarUrl={friendAvatarUrl}
              size={Math.round(height * 0.065)}
            />
          </View>
        </View>
      </View>

      <View style={styles.roundedBox}>
        <LinearGradient
          colors={theme.gradients.overlay as any}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={theme.gradients.overlayLocations as any}
          style={styles.gradientBackground}
        />

        {deck.cards.length > 0 ? (
          <SwipeCard
            card={deck.cards[deck.currentCardIndex]}
            styles={cardStyles}
            pan={deck.pan}
            refreshAnim={deck.refreshAnim}
            flipAnimation={deck.flipAnimation}
            isFlipped={deck.isFlipped}
            panResponder={deck.panResponder}
            renderEmpty={renderEmptyState}
            renderFront={() => (
              <CardFront
                card={deck.cards[deck.currentCardIndex]}
                index={deck.currentCardIndex}
                styles={cardStyles}
                imageCarouselWidth={deck.imageCarouselWidth}
                screenWidth={deck.screenWidth}
                cardWidthFraction={0.80}
                onImageLayout={deck.handleImageLayout}
                imageScrollViewRef={deck.imageScrollViewRef}
                onImageScroll={deck.handleImageScroll}
                currentImageIndex={deck.currentImageIndex}
                onScrollToImage={deck.scrollToImageIndex}
                onFlip={deck.handleFlip}
                showSizeSelection={deck.showSizeSelection}
                sizePanelAnimatedStyle={deck.sizePanelAnimatedStyle}
                cartButtonScale={deck.cartButtonScale}
                onCartPressIn={deck.handleCartPressIn}
                onCartPressOut={deck.handleCartPressOut}
                onCartPress={deck.handleCartPress}
                onCancelSizeSelection={deck.handleCancelSizeSelection}
                onSizeSelect={deck.handleSizeSelect}
                userSelectedSize={deck.userSelectedSize}
                colorSelectorOpen={deck.colorSelectorOpen}
                colorDropdownAnimatedStyle={deck.colorDropdownAnimatedStyle}
                onColorSelect={deck.handleColorSelect}
                onOpenColorSelector={deck.openColorSelector}
                onCloseColorSelector={deck.closeColorSelector}
                onToggleLike={() => deck.toggleLike(deck.currentCardIndex)}
                onLongPress={() => deck.handleLongPress(deck.currentCardIndex)}
              />
            )}
            renderBack={() => (
              <CardBack
                card={deck.cards[deck.currentCardIndex]}
                styles={cardStyles}
                onFlip={deck.handleFlip}
                headerPanResponder={deck.headerPanResponder}
                scrollViewRef={deck.scrollViewRef}
              />
            )}
          />
        ) : (
          renderEmptyState()
        )}

        <RNAnimated.View style={{ opacity: deck.refreshAnim, width: "100%", height: "100%" }}>
          <RNAnimated.View style={[cardStyles.text, { opacity: deck.fadeAnim }]}>
            {deck.cards.length > 0 ? (
              <>
                <Text style={cardStyles.brandName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                  {currentCard?.brand_name || "бренд не указан"}
                </Text>
                {hasSale ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={[cardStyles.price, cardStyles.priceStrikethrough]}>
                      {`${formatPrice(currentCard!.price)} ₽`}
                    </Text>
                    <Text style={[cardStyles.price, cardStyles.priceSale]}>
                      {`${formatPrice(displaySalePrice!)} ₽`}
                    </Text>
                  </View>
                ) : (
                  <Text style={cardStyles.price}>
                    {`${currentCard ? formatPrice(currentCard.price) : "0,00"} ₽`}
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={cardStyles.name} numberOfLines={1}>Загрузка...</Text>
                <Text style={cardStyles.price}>Пожалуйста, подождите</Text>
              </>
            )}
          </RNAnimated.View>
        </RNAnimated.View>
      </View>
    </Animated.View>
  );
};

const createScreenStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: "space-evenly",
      alignItems: "center",
      backgroundColor: "transparent",
    },
    friendHeader: {
      width: "100%",
      height: height * 0.065,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: width * 0.06,
      zIndex: 1000,
    },
    backButtonContainer: {
      width: height * 0.065,
      height: height * 0.065,
      borderRadius: height * 0.065 * 0.5,
      backgroundColor: theme.surface.friend,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    backButton: {
      width: height * 0.05,
      height: height * 0.05,
      justifyContent: "center",
      alignItems: "center",
    },
    friendInfoContainer: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    friendIconContainer: {
      width: height * 0.065,
      height: height * 0.065,
      borderRadius: height * 0.065 * 0.5,
      backgroundColor: theme.surface.friend,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    friendUsernameShadowWrapper: {
      height: height * 0.065,
      borderRadius: height * 0.065 * 0.5,
      minWidth: width * 0.5,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
    },
    friendUsernameWrapper: {
      height: "100%",
      width: "100%",
      borderRadius: height * 0.065 * 0.5,
      position: "relative",
      overflow: "hidden",
    },
    friendUsernameBorder: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: height * 0.065 * 0.5,
    },
    friendUsernameInnerWrapper: {
      width: "100%",
      height: "100%",
      padding: 3,
      borderRadius: height * 0.065 * 0.5,
    },
    friendUsernameContainer: {
      width: "100%",
      height: "100%",
      borderRadius: (height * 0.065 - 6) * 0.5,
      backgroundColor: theme.surface.friend,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: width * 0.06,
    },
    friendUsername: {
      fontFamily: "IgraSans",
      fontSize: 22,
      color: theme.text.primary,
    },
    gradientBackground: {
      borderRadius: 30,
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    roundedBox: {
      width: "80%",
      height: "85%",
      borderRadius: 35,
      backgroundColor: theme.primary + "00",
      position: "relative",
      borderWidth: 3,
      borderColor: theme.primary + "66",
      zIndex: 900,
    },
  });

export default FriendRecommendationsScreen;
