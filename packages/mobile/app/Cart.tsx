import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Dimensions,
  Easing,
  Animated as RNAnimated,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutDown,
} from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import Cancel from "./components/svg/Cancel";
import { RoundedRect, Shadow, Canvas } from "@shopify/react-native-skia";
import * as api from "./services/api";
import {
  retrieveUserProfile,
  getPaymentStatus,
  getShoppingInfo,
  getBrands,
  sessionManager,
} from "./services/api";
import { CartItem, DeliveryInfo, Product } from "./types/product";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "./lib/animations";
import { useTheme } from "./lib/ThemeContext";
import type { ThemeColors } from "./lib/theme";

const { height, width } = Dimensions.get("window");

interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
}

interface CartProps {
  navigation: SimpleNavigation;
}

const DELIVERY_TIMES = ["1-3 дня", "2-4 дня", "1 день"];
const DEFAULT_SHIPPING_PRICE = 350;

/** Pick a random delivery time for display (placeholder, not from backend). */
const getRandomDeliveryTime = (itemId: string): string => {
  const hash = (parseInt(itemId, 10) || 0) % DELIVERY_TIMES.length;
  return DELIVERY_TIMES[hash] ?? "1-3 дня";
};

/** Return real delivery time from product data, or fallback to random. */
const getDeliveryTimeForItem = (item: {
  id: string;
  delivery_time_min?: number | null;
  delivery_time_max?: number | null;
}): string => {
  const { delivery_time_min: min, delivery_time_max: max } = item;
  if (min != null && max != null) return `${min}–${max} дней`;
  if (min != null) return `от ${min} дней`;
  if (max != null) return `до ${max} дней`;
  return getRandomDeliveryTime(item.id);
};

/** Map brand id -> Brand (for shipping_price, min_free_shipping). */
type BrandMap = Record<string, api.Brand>;

/**
 * Compute delivery info for cart items using brand profile data and free shipping policy.
 * Shipping cost comes from brand.shipping_price; free shipping when brand subtotal >= min_free_shipping.
 * Delivery time is a random placeholder.
 */
const computeDeliveryForItems = (
  items: Array<{
    brand_id?: string;
    price: number;
    quantity: number;
    id: string;
    cartItemId?: string;
    delivery_time_min?: number | null;
    delivery_time_max?: number | null;
  }>,
  brandsMap: BrandMap,
): DeliveryInfo[] => {
  // Per-brand: subtotal and shipping cost (0 if free shipping)
  const brandSubtotals: Record<string, number> = {};
  const brandShippingCosts: Record<string, number> = {};

  for (const item of items) {
    const bid = item.brand_id ?? "";
    const subtotal = item.price * (item.quantity ?? 1);
    brandSubtotals[bid] = (brandSubtotals[bid] ?? 0) + subtotal;
  }

  for (const bid of Object.keys(brandSubtotals)) {
    const subtotal = brandSubtotals[bid];
    const brand = brandsMap[bid];
    const minFree = brand?.min_free_shipping;
    const shippingPrice = brand?.shipping_price ?? DEFAULT_SHIPPING_PRICE;
    if (minFree != null && subtotal >= minFree) {
      brandShippingCosts[bid] = 0;
    } else {
      brandShippingCosts[bid] = shippingPrice;
    }
  }

  // Allocate brand shipping to items proportionally, return in same order
  return items.map((item) => {
    const bid = item.brand_id ?? "";
    const subtotal = item.price * (item.quantity ?? 1);
    const brandSubtotal = brandSubtotals[bid] ?? subtotal;
    const brandShipping = brandShippingCosts[bid] ?? DEFAULT_SHIPPING_PRICE;
    const allocatedCost =
      brandSubtotal > 0 ? (subtotal / brandSubtotal) * brandShipping : 0;
    return {
      cost: Math.round(allocatedCost * 100) / 100,
      estimatedTime: getDeliveryTimeForItem(item),
    };
  });
};

interface CancelButtonProps {
  onRemove: (cartItemId: string) => void;
  cartItemId: string;
}

const CancelButton: React.FC<CancelButtonProps> = ({
  onRemove,
  cartItemId,
}) => {
  const { theme } = useTheme();
  const scale = useRef(new RNAnimated.Value(1)).current;
  const handlePressIn = () =>
    RNAnimated.timing(scale, {
      toValue: 0.85,
      duration: 80,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
  const handlePressOut = () => {
    RNAnimated.timing(scale, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start();
    onRemove(cartItemId);
  };

  const removeButtonStyle = {
    width: 25,
    height: 25,
    borderRadius: 7,
    backgroundColor: theme.interactive.remove,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    position: 'absolute' as const,
    right: 8,
    top: 0,
  };

  return (
    <RNAnimated.View style={[{ transform: [{ scale }] }, removeButtonStyle]}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Cancel width={27} height={27} />
      </Pressable>
    </RNAnimated.View>
  );
};

const CartItemImage = ({ item }: { item: CartItem }) => {
  const { theme } = useTheme();
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const onImageLoad = (event: any) => {
    const { width, height } = event.nativeEvent.source;
    setImageDimensions({ width, height });
  };
  const aspectRatio =
    imageDimensions.width && imageDimensions.height
      ? imageDimensions.width / imageDimensions.height
      : 1;

  const imageStyles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
    },
    itemImage: {
      width: '100%',
      height: '100%',
    },
    noProductImagePlaceholder: {
      backgroundColor: theme.surface.button,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      width: '73%',
      height: '73%',
    },
    noProductImageText: {
      fontFamily: 'IgraSans',
      fontSize: 12,
      color: theme.text.disabled,
    },
  });

  return (
    <View style={imageStyles.container}>
      {item.images && item.images.length > 0 ? (
        <Image
          source={item.images[0]}
          style={[imageStyles.itemImage, { aspectRatio }]}
          resizeMode="contain"
          onLoad={onImageLoad}
        />
      ) : (
        <View style={[imageStyles.itemImage, imageStyles.noProductImagePlaceholder]}>
          <Text style={imageStyles.noProductImageText}>Нет изображения</Text>
        </View>
      )}
    </View>
  );
};

const Cart = ({ navigation }: CartProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [brandsMap, setBrandsMap] = useState<BrandMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { width } = Dimensions.get("window");

  // Load brands for shipping_price and min_free_shipping
  useEffect(() => {
    getBrands()
      .then((brands) => {
        const map: BrandMap = {};
        for (const b of brands) {
          map[b.id] = b;
        }
        setBrandsMap(map);
      })
      .catch((e) => console.warn("Cart: failed to load brands", e));
  }, []);

  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const url = new URL(event.url);
      const paymentId = url.searchParams.get("payment_id");

      console.log(paymentId);
      if (paymentId) {
        try {
          const paymentStatusResponse = await api.getPaymentStatus(paymentId);

          if (paymentStatusResponse.status === "succeeded") {
            setShowConfirmation(true);
          } else if (paymentStatusResponse.status === "canceled") {
            setPaymentError("Payment was canceled.");
          } else {
            setPaymentError("Payment status is unknown or pending.");
          }
        } catch (error) {
          setPaymentError("Failed to verify payment status.");
        }
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const loadData = () => {
      if (!global.cartStorage) {
        setIsLoading(true);
        return;
      }
      setIsLoading(true);
      const items = [...global.cartStorage.getItems()];
      const rawItems = items.map((item: any) => ({
        ...item,
        id: item.id,
        brand_id: item.brand_id,
        price: item.price,
        quantity: item.quantity ?? 1,
        cartItemId:
          item.cartItemId ||
          `${item.id}-${item.size}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      }));
      const deliveries = computeDeliveryForItems(rawItems, brandsMap);
      const itemsWithDelivery: CartItem[] = rawItems.map((item: any, idx: number) => {
        const newItem: CartItem = {
          ...item,
          id: item.id,
          name: item.name,
          price: item.price,
          images: item.images ?? [],
          size: item.size,
          quantity: item.quantity ?? 1,
          isLiked: item.isLiked,
          cartItemId: item.cartItemId,
          brand_name: item.brand_name,
          brand_id: item.brand_id,
          brand_return_policy: item.brand_return_policy ?? "",
          description: item.description ?? "",
          materials: item.materials ?? "",
          color: item.color ?? "",
          color_variants: item.color_variants ?? [],
          selected_color_index: item.selected_color_index ?? 0,
          variants: item.variants,
          article_number: item.article_number,
          product_variant_id: item.product_variant_id,
          delivery: deliveries[idx] ?? { cost: DEFAULT_SHIPPING_PRICE, estimatedTime: "1-3 дня" },
        };
        return newItem;
      });
      setCartItems(itemsWithDelivery);
      setIsLoading(false);
    };
    loadData();
    const intervalId = setInterval(() => {
      if (global.cartStorage) {
        const items = [...global.cartStorage.getItems()];
        setCartItems((prevItems) => {
          const hasChanges =
            items.length !== prevItems.length ||
            items.some(
              (newItem) =>
                !prevItems.find(
                  (item) =>
                    item.cartItemId === newItem.cartItemId &&
                    item.quantity === newItem.quantity,
                ),
            );
          if (!hasChanges) return prevItems;
          const rawItems = items.map((item: any) => ({
            ...item,
            id: item.id,
            brand_id: item.brand_id,
            price: item.price,
            quantity: item.quantity ?? 1,
            cartItemId: item.cartItemId,
          }));
          const deliveries = computeDeliveryForItems(rawItems, brandsMap);
          return items.map((newItem: any, idx: number) => ({
            ...newItem,
            delivery: deliveries[idx] ?? { cost: DEFAULT_SHIPPING_PRICE, estimatedTime: "1-3 дня" },
            product_variant_id: newItem.product_variant_id,
          })) as CartItem[];
        });
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [global.cartStorage, brandsMap]);

  // Listen for session events to clear cart when user logs out or session expires
  useEffect(() => {
    const handleSessionEvent = () => {
      console.log("Cart - Session event received, clearing cart items");
      setCartItems([]);
    };

    const unsubscribe = sessionManager.addListener((event) => {
      if (
        event === "session_cleared" ||
        event === "token_expired" ||
        event === "login_required"
      ) {
        handleSessionEvent();
      }
    });

    return unsubscribe;
  }, []);

  const removeItem = (cartItemId: string) => {
    if (global.cartStorage) {
      global.cartStorage.removeItem(cartItemId);
      setCartItems((prevItems) =>
        prevItems.filter((item) => item.cartItemId !== cartItemId),
      );
    }
  };

  const handleItemPress = (item: CartItem) => {
    // Spread the entire item to preserve all fields including article_number
    // CartItem extends CardItem, so we can safely spread it (delivery and cartItemId will be ignored by MainPage)
    const { delivery, cartItemId, ...cardItem } = item; // Exclude CartItem-specific fields
    navigation.navigate("Home", { addCardItem: cardItem as Product });
  };

  const calculateRawTotal = () =>
    cartItems.reduce(
      (total, item) =>
        total + item.price * (item.quantity ?? 1) + item.delivery.cost,
      0,
    );
  const calculateTotal = () => `${calculateRawTotal().toFixed(2)} ₽`;

  const validateAddressInformation = async (): Promise<{
    isValid: boolean;
    missingFields: string[];
  }> => {
    try {
      const shoppingInfo = await getShoppingInfo();
      const missingFields: string[] = [];

      if (!shoppingInfo.full_name || shoppingInfo.full_name.trim() === "") {
        missingFields.push("полное имя");
      }

      if (!shoppingInfo.phone || shoppingInfo.phone.trim() === "") {
        missingFields.push("телефон");
      }

      if (!shoppingInfo.street || shoppingInfo.street.trim() === "") {
        missingFields.push("улица");
      }

      if (!shoppingInfo.city || shoppingInfo.city.trim() === "") {
        missingFields.push("город");
      }

      if (
        !shoppingInfo.delivery_email ||
        shoppingInfo.delivery_email.trim() === ""
      ) {
        missingFields.push("email для доставки");
      }

      return {
        isValid: missingFields.length === 0,
        missingFields,
      };
    } catch (error) {
      console.error("Error validating address information:", error);
      return {
        isValid: false,
        missingFields: ["не удалось загрузить информацию о доставке"],
      };
    }
  };

  const handleCheckout = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setPaymentError(null);
    try {
      const totalAmount = calculateRawTotal();
      if (totalAmount <= 0) {
        setPaymentError("Cannot proceed with an empty cart.");
        setIsSubmitting(false);
        return;
      }

      // Validate address information before proceeding
      const addressValidation = await validateAddressInformation();
      if (!addressValidation.isValid) {
        const missingFieldsText = addressValidation.missingFields.join(", ");
        setPaymentError(
          `для оформления заказа необходимо заполнить информацию о доставке: ${missingFieldsText}. пожалуйста, перейдите в настройки профиля.`,
        );
        setIsSubmitting(false);
        return;
      }

      await retrieveUserProfile();
      const receiptItems = cartItems
        .filter((item) => item.product_variant_id)
        .map((item) => ({
          product_variant_id: item.product_variant_id!,
          quantity: item.quantity ?? 1,
        }));
      if (receiptItems.length === 0) {
        setPaymentError("Нет товаров с выбранным размером для оплаты.");
        setIsSubmitting(false);
        return;
      }

      // TEST MODE: Create order in database (no payment platform)
      await api.createOrderTest(totalAmount, receiptItems);

      // Clear cart immediately after successful order (in-memory + persistent storage)
      if (global.cartStorage) {
        cartItems.forEach(
          (item) =>
            item.cartItemId && global.cartStorage.removeItem(item.cartItemId),
        );
        setCartItems([]);
      }
      setShowConfirmation(true);

      // Payment platform calls (disabled in test mode):
      // const paymentDetails: api.PaymentCreateRequest = { ... };
      // const { confirmation_url } = await api.createPayment(paymentDetails);
      // await WebBrowser.openBrowserAsync(confirmation_url);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "An unknown error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
    if (global.cartStorage) {
      cartItems.forEach(
        (item) =>
          item.cartItemId && global.cartStorage.removeItem(item.cartItemId),
      );
      setCartItems([]);
    }
    navigation.navigate("Home");
  };

  const LoadingScreen = () => (
    <Animated.View
      entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
      style={styles.loadingContainer}
    >
      <Text style={styles.loadingText}>перенаправление на оплату...</Text>
    </Animated.View>
  );
  const ConfirmationScreen = () => (
    <Animated.View
      entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
      style={styles.confirmationContainer}
    >
      <Text style={styles.confirmationTitle}>Заказ оформлен!</Text>
      <Text style={styles.confirmationText}>Спасибо за покупку</Text>
      <TouchableOpacity
        style={styles.confirmationButton}
        onPress={handleConfirmationClose}
      >
        <Text style={styles.confirmationButtonText}>Вернуться к покупкам</Text>
      </TouchableOpacity>
    </Animated.View>
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
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        style={styles.roundedBox}
      >
        <LinearGradient
          colors={theme.gradients.overlay as any}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={theme.gradients.overlayLocations as any}
          style={styles.gradientBackground}
        />
        <Animated.View style={styles.whiteBox}>
          {isSubmitting && !showConfirmation ? (
            <LoadingScreen />
          ) : showConfirmation ? (
            <ConfirmationScreen />
          ) : cartItems.length === 0 ? (
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                ANIMATION_DELAYS.STANDARD,
              )}
              style={styles.emptyCartContainer}
            >
              <Text style={styles.emptyCartText}>ваша корзина пуста</Text>
              <Pressable
                style={styles.shopButton}
                onPress={() => navigation.navigate("Home")}
              >
                <Text style={styles.shopButtonText}>продолжить покупки</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <>
              <ScrollView
                style={styles.itemsContainer}
                showsVerticalScrollIndicator={false}
              >
                {cartItems.map((item, index) => (
                  <Animated.View
                    key={item.cartItemId || `${item.id}-${item.size}-${index}`}
                    entering={FadeInDown.duration(
                      ANIMATION_DURATIONS.MEDIUM,
                    ).delay(
                      ANIMATION_DELAYS.STANDARD +
                        index * ANIMATION_DELAYS.SMALL,
                    )}
                    style={styles.cartItem}
                  >
                    <Pressable
                      style={styles.itemPressable}
                      onPress={() => handleItemPress(item)}
                    >
                      <View style={styles.itemContent}>
                        <View style={styles.imageContainer}>
                          <CartItemImage item={item} />
                        </View>
                        <View style={styles.itemDetails}>
                          <Text
                            style={styles.itemName}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.brand_name}
                          </Text>
                          <Text style={styles.itemPrice}>{`${item.price.toFixed(
                            2,
                          )} ₽`}</Text>
                          <Text style={styles.itemSize}>{item.size}</Text>
                          <View>
                            <Text style={styles.deliveryText}>ожидание</Text>
                            <Text style={styles.deliveryText}>доставка</Text>
                          </View>
                          <View style={styles.deliveryInfoChangeable}>
                            <Text
                              style={styles.deliveryText}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {item.delivery.estimatedTime}
                            </Text>
                            <Text
                              style={styles.deliveryText}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                            >
                              {`${item.delivery.cost.toFixed(2)} ₽`}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.rightContainer}>
                        <CancelButton
                          onRemove={removeItem}
                          cartItemId={
                            item.cartItemId ||
                            `${item.id}-${item.size}-${index}`
                          }
                        />
                        <View style={styles.circle}>
                          <Canvas
                            style={{
                              width: 41,
                              height: 41,
                              backgroundColor: "transparent",
                            }}
                          >
                            <RoundedRect
                              x={0}
                              y={0}
                              width={41}
                              height={41}
                              r={20.5}
                              color="white"
                            >
                              <Shadow
                                dx={0}
                                dy={4}
                                blur={4}
                                color="rgba(0,0,0,0.5)"
                                inner
                              />
                            </RoundedRect>
                          </Canvas>
                        </View>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
              </ScrollView>
              <Animated.View style={styles.checkoutContainer}>
                <Animated.View
                  style={styles.summaryContainer}
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.LARGE)}
                >
                  <View style={styles.horizontalLine} />
                  <View style={styles.totalContainer}>
                    <Text style={styles.totalText}>
                      ИТОГО {calculateTotal()}
                    </Text>
                  </View>
                </Animated.View>
                {paymentError && (
                  <Animated.View
                    entering={FadeIn.duration(ANIMATION_DURATIONS.STANDARD)}
                    style={styles.errorContainer}
                  >
                    <Text style={styles.errorText}>{paymentError}</Text>
                    {paymentError.includes("информацию о доставке") && (
                      <TouchableOpacity
                        style={styles.settingsButton}
                        onPress={() => navigation.navigate("Settings")}
                      >
                        <Text style={styles.settingsButtonText}>
                          Перейти в настройки
                        </Text>
                      </TouchableOpacity>
                    )}
                  </Animated.View>
                )}
                <Animated.View
                  entering={FadeInDown.duration(
                    ANIMATION_DURATIONS.MEDIUM,
                  ).delay(ANIMATION_DELAYS.EXTENDED)}
                  style={{ width: "100%" }}
                >
                  <TouchableOpacity
                    style={[
                      styles.checkoutButton,
                      isSubmitting && styles.disabledButton,
                    ]}
                    onPress={handleCheckout}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.checkoutButtonText}>
                      {isSubmitting ? "ОБРАБОТКА..." : "ОФОРМИТЬ ЗАКАЗ"}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
            </>
          )}
        </Animated.View>
        <View style={styles.textContainer}>
          <Text style={styles.text}>КОРЗИНА</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const createStyles = (theme: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  roundedBox: {
    width: "88%",
    height: "95%",
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
  whiteBox: {
    backgroundColor: theme.background.primary,
    borderRadius: 41,
    width: width * 0.88,
    top: -3,
    left: -3,
    height: "90%",
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  itemsContainer: { height: "70%", borderRadius: 41, padding: height * 0.02 },
  cartItem: {
    backgroundColor: theme.surface.cartItem,
    borderRadius: 41,
    marginBottom: 15,
    shadowColor: theme.shadow.default,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    flex: 1,
  },
  itemPressable: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingTop: 20,
    paddingLeft: 25,
    paddingRight: 20,
    paddingBottom: 15,
  },
  itemContent: { flexDirection: "row", width: "80%", alignItems: "flex-start" },
  itemImage: {
    width: "100%",
    height: undefined,
    justifyContent: "flex-start",
    position: "absolute",
    top: 0,
    left: 0,
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
  imageContainer: {
    width: "30%",
    height: "100%",
    alignSelf: "flex-start",
    marginRight: 15,
    justifyContent: "flex-start",
  },
  itemDetails: { flex: 1, justifyContent: "flex-start" },
  itemName: {
    fontFamily: "IgraSans",
    fontSize: 38,
    color: theme.text.primary,
    marginBottom: 0,
  },
  itemPrice: {
    fontFamily: "REM",
    fontSize: 16,
    color: theme.text.primary,
    marginBottom: 5,
  },
  itemSize: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: theme.text.primary,
    marginBottom: 20,
  },
  deliveryInfoChangeable: {
    position: "absolute",
    marginLeft: width * 0.22,
    bottom: 0,
    width: width * 0.5,
  },
  deliveryText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: theme.text.primary,
    marginBottom: 5,
    flexShrink: 1,
  },
  rightContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "20%",
  },
  circle: { position: "absolute", top: "30%", bottom: "30%", right: 0 },
  checkoutContainer: { borderRadius: 41, padding: 20, alignItems: "center" },
  summaryContainer: {
    marginBottom: 10,
    width: "87%",
    alignItems: "center",
    justifyContent: "center",
  },
  horizontalLine: {
    width: "100%",
    height: 3,
    backgroundColor: theme.text.primary,
  },
  totalContainer: { width: "100%", alignItems: "flex-start", marginTop: 25 },
  totalText: {
    textAlign: "left",
    fontFamily: "IgraSans",
    fontSize: 30,
    color: theme.text.primary,
  },
  checkoutButton: {
    width: "100%",
    backgroundColor: theme.button.checkout,
    borderRadius: 41,
    padding: 25,
    alignItems: "center",
  },
  checkoutButtonText: {
    color: theme.button.checkoutText,
    fontFamily: "IgraSans",
    fontSize: 20,
  },
  disabledButton: { backgroundColor: theme.interactive.inactive },
  emptyCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCartText: {
    fontFamily: "REM",
    fontSize: 18,
    color: theme.text.secondary,
    marginBottom: 20,
  },
  shopButton: {
    backgroundColor: theme.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    width: "80%",
  },
  shopButtonText: { color: "white", fontFamily: "IgraSans", fontSize: 18 },
  textContainer: {
    position: "absolute",
    bottom: 0,
    marginBottom: 12,
    marginLeft: 22,
  },
  text: {
    fontFamily: "Igra Sans",
    fontSize: 38,
    color: theme.text.inverse,
    textAlign: "left",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background.primary,
    borderRadius: 41,
    padding: 20,
  },
  loadingText: { fontFamily: "IgraSans", fontSize: 24, color: theme.text.secondary },
  confirmationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.background.primary,
    borderRadius: 41,
    padding: 20,
  },
  confirmationTitle: {
    fontFamily: "IgraSans",
    fontSize: 38,
    color: theme.text.secondary,
    marginBottom: 20,
    textAlign: "center",
  },
  confirmationText: {
    fontFamily: "REM",
    fontSize: 18,
    color: theme.text.secondary,
    marginBottom: 40,
    textAlign: "center",
  },
  confirmationButton: {
    backgroundColor: theme.primary,
    borderRadius: 25,
    padding: 15,
    alignItems: "center",
    width: "80%",
  },
  confirmationButtonText: {
    color: "white",
    fontFamily: "IgraSans",
    fontSize: 18,
  },
  errorContainer: { marginBottom: 15, alignItems: "center" },
  errorText: {
    color: theme.status.error,
    fontFamily: "REM",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  settingsButton: {
    backgroundColor: theme.primary,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 5,
  },
  settingsButtonText: {
    color: theme.button.primaryText,
    fontFamily: "IgraSans",
    fontSize: 14,
    textAlign: "center",
  },
});



export default Cart;
