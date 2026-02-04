import React, { useState, useEffect, useRef } from "react";
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
  sessionManager,
} from "./services/api";
import { CartItem, DeliveryInfo, Product } from "./types/product";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "./lib/animations";

const { height, width } = Dimensions.get("window");

interface SimpleNavigation {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
}

interface CartProps {
  navigation: SimpleNavigation;
}

const getItemDeliveryInfo = (
  itemId: string,
  quantity: number
): DeliveryInfo => {
  let cost = 350.0;
  let time = "1-3 дня";
  const numericId = parseInt(itemId) || 0;
  if (numericId % 3 === 0) {
    cost = 250.0;
    time = "2-4 дня";
  } else if (numericId % 2 === 0) {
    cost = 400.0;
    time = "1 день";
  }
  if (quantity > 1) {
    const adjustedCost = Math.round(cost * (1 + (quantity - 1) * 0.1));
    cost = adjustedCost;
  }
  return { cost, estimatedTime: time };
};

interface CancelButtonProps {
  onRemove: (cartItemId: string) => void;
  cartItemId: string;
}

const CancelButton: React.FC<CancelButtonProps> = ({
  onRemove,
  cartItemId,
}) => {
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
  return (
    <RNAnimated.View style={[{ transform: [{ scale }] }, styles.removeButton]}>
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Cancel width={27} height={27} />
      </Pressable>
    </RNAnimated.View>
  );
};

const CartItemImage = ({ item }: { item: CartItem }) => {
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
  return (
    <View style={styles.container}>
      <Image
        source={
          item.images && item.images.length > 0
            ? item.images[0]
            : require("./assets/Vision.png")
        }
        style={[styles.itemImage, { aspectRatio }]}
        resizeMode="contain"
        onLoad={onImageLoad}
      />
    </View>
  );
};

const Cart = ({ navigation }: CartProps) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const { width } = Dimensions.get("window");

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

    Linking.addEventListener("url", handleDeepLink);
    return () => {
      Linking.removeAllListeners("url");
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
      const itemsWithDelivery = items.map((item: any) => {
        const newItem: CartItem = {
          ...item,
          id: item.id,
          name: item.name,
          price: item.price,
          images: item.images ?? [],
          size: item.size,
          quantity: item.quantity ?? 1,
          isLiked: item.isLiked,
          cartItemId:
            item.cartItemId || `${item.id}-${item.size}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          brand_name: item.brand_name,
          brand_return_policy: item.brand_return_policy ?? "",
          description: item.description ?? "",
          materials: item.materials ?? "",
          color: item.color ?? "",
          color_variants: item.color_variants ?? [],
          selected_color_index: item.selected_color_index ?? 0,
          variants: item.variants,
          article_number: item.article_number,
          product_variant_id: item.product_variant_id,
        };
        const delivery = getItemDeliveryInfo(newItem.id, newItem.quantity!);
        return { ...newItem, delivery } as CartItem;
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
                    item.quantity === newItem.quantity
                )
            );
          if (!hasChanges) return prevItems;
          return items.map((newItem: any) => {
            const existingItem = prevItems.find(
              (item) => item.cartItemId === newItem.cartItemId
            );
            const delivery = existingItem?.delivery ?? getItemDeliveryInfo(newItem.id, newItem.quantity ?? 1);
            return {
              ...newItem,
              delivery,
              product_variant_id: newItem.product_variant_id,
            } as CartItem;
          });
        });
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [global.cartStorage]);

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
        prevItems.filter((item) => item.cartItemId !== cartItemId)
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
      (total, item) => total + item.price + item.delivery.cost,
      0
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
          `для оформления заказа необходимо заполнить информацию о доставке: ${missingFieldsText}. пожалуйста, перейдите в настройки профиля.`
        );
        setIsSubmitting(false);
        return;
      }

      const currentUserProfile = await retrieveUserProfile();
      console.log(cartItems[0]);
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

      const paymentDetails: api.PaymentCreateRequest = {
        amount: {
          value: totalAmount,
          currency: "RUB",
        },
        description: `Order #${Math.floor(Math.random() * 1000)}`,
        returnUrl: "polkamobile://payment-callback", // Generic base deep link
        items: receiptItems,
      };

      const { confirmation_url, payment_id } = await api.createPayment(
        paymentDetails
      );
      if (!confirmation_url)
        throw new Error("Failed to retrieve confirmation URL.");
      await WebBrowser.openBrowserAsync(confirmation_url);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "An unknown error occurred."
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
          item.cartItemId && global.cartStorage.removeItem(item.cartItemId)
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
        ANIMATION_DELAYS.LARGE
      )}
      exiting={FadeOutDown.duration(ANIMATION_DURATIONS.MICRO)}
    >
      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        style={styles.roundedBox}
      >
        <LinearGradient
          colors={["rgba(205, 166, 122, 0.5)", "transparent"]}
          start={{ x: 0.1, y: 1 }}
          end={{ x: 0.9, y: 0.3 }}
          locations={[0.1, 1]}
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
                ANIMATION_DELAYS.STANDARD
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
                      ANIMATION_DURATIONS.MEDIUM
                    ).delay(
                      ANIMATION_DELAYS.STANDARD + index * ANIMATION_DELAYS.SMALL
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
                            2
                          )} ₽`}</Text>
                          <Text style={styles.itemSize}>{item.size}</Text>
                          <View>
                            <Text style={styles.deliveryText}>ожидание</Text>
                            <Text style={styles.deliveryText}>доставка</Text>
                          </View>
                          <View style={styles.deliveryInfoChangeable}>
                            <Text style={styles.deliveryText}>
                              {item.delivery.estimatedTime}
                            </Text>
                            <Text
                              style={styles.deliveryText}
                            >{`${item.delivery.cost.toFixed(2)} ₽`}</Text>
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
                    ANIMATION_DURATIONS.MEDIUM
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
                    ANIMATION_DURATIONS.MEDIUM
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

const styles = StyleSheet.create({
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
    backgroundColor: "rgba(205, 166, 122, 0)",
    position: "relative",
    borderWidth: 3,
    borderColor: "rgba(205, 166, 122, 0.4)",
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
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    width: width * 0.88,
    top: -3,
    left: -3,
    height: "90%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  itemsContainer: { height: "70%", borderRadius: 41, padding: height * 0.02 },
  cartItem: {
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    marginBottom: 15,
    shadowColor: "#000",
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
    color: "#000",
    marginBottom: 0,
  },
  itemPrice: {
    fontFamily: "REM",
    fontSize: 16,
    color: "#000",
    marginBottom: 5,
  },
  itemSize: {
    fontFamily: "IgraSans",
    fontSize: 16,
    color: "#000",
    marginBottom: 20,
  },
  deliveryInfoChangeable: {
    position: "absolute",
    marginLeft: width * 0.22,
    bottom: 0,
  },
  deliveryText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: "#000",
    marginBottom: 5,
  },
  rightContainer: {
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
    width: "20%",
  },
  removeButton: {
    width: 25,
    height: 25,
    borderRadius: 7,
    backgroundColor: "rgba(230, 109, 123, 0.54)",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    right: 8,
    top: 0,
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
    backgroundColor: "rgba(0, 0, 0, 1)",
  },
  totalContainer: { width: "100%", alignItems: "flex-start", marginTop: 25 },
  totalText: {
    textAlign: "left",
    fontFamily: "IgraSans",
    fontSize: 30,
    color: "#000",
  },
  checkoutButton: {
    width: "100%",
    backgroundColor: "#98907E",
    borderRadius: 41,
    padding: 25,
    alignItems: "center",
  },
  checkoutButtonText: {
    color: "#FFFFF5",
    fontFamily: "IgraSans",
    fontSize: 20,
  },
  disabledButton: { backgroundColor: "#BDBDBD" },
  emptyCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyCartText: {
    fontFamily: "REM",
    fontSize: 18,
    color: "#666",
    marginBottom: 20,
  },
  shopButton: {
    backgroundColor: "#CDA67A",
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
    color: "#FFF",
    textAlign: "left",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    padding: 20,
  },
  loadingText: { fontFamily: "IgraSans", fontSize: 24, color: "#4A3120" },
  confirmationContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    padding: 20,
  },
  confirmationTitle: {
    fontFamily: "IgraSans",
    fontSize: 38,
    color: "#4A3120",
    marginBottom: 20,
    textAlign: "center",
  },
  confirmationText: {
    fontFamily: "REM",
    fontSize: 18,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  confirmationButton: {
    backgroundColor: "#CDA67A",
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
    color: "#D32F2F",
    fontFamily: "REM",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  settingsButton: {
    backgroundColor: "#CDA67A",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 5,
  },
  settingsButtonText: {
    color: "#FFFFF5",
    fontFamily: "IgraSans",
    fontSize: 14,
    textAlign: "center",
  },
});

export default Cart;
