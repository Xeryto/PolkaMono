import React, { useMemo } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { width, height } = Dimensions.get("window");

const usePulse = () => {
  const opacity = useSharedValue(0.3);
  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
};

/** Grid skeleton card matching Search/Favorites 2-column layout */
export const SkeletonCard = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createGridStyles(theme), [theme]);
  const pulseStyle = usePulse();

  return <Animated.View style={[styles.card, pulseStyle]} />;
};

/** Grid of skeleton cards for Search/Favorites loading state */
export const SkeletonGrid = ({ count = 6 }: { count?: number }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createGridStyles(theme), [theme]);

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
};

/** Horizontal skeleton card matching Cart item layout */
export const SkeletonCartItem = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => createCartStyles(theme), [theme]);
  const pulseStyle = usePulse();

  return (
    <View style={styles.cartItem}>
      <Animated.View style={[styles.imagePlaceholder, pulseStyle]} />
      <View style={styles.textGroup}>
        <Animated.View style={[styles.textBar, pulseStyle]} />
        <Animated.View style={[styles.textBarShort, pulseStyle]} />
        <Animated.View style={[styles.textBarTiny, pulseStyle]} />
      </View>
    </View>
  );
};

/** Full-card skeleton for swipe deck loading state */
export const SkeletonSwipeCard = () => {
  const { theme } = useTheme();
  const pulseStyle = usePulse();

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          borderRadius: 41,
          backgroundColor: theme.button.disabled,
        },
        pulseStyle,
      ]}
    />
  );
};

/** Skeleton matching order oval-bubble + summary layout */
export const SkeletonOrderItem = () => {
  const { theme } = useTheme();
  const pulseStyle = usePulse();
  return (
    <View style={{ marginBottom: 25 }}>
      {/* orderBubble: row with text area + return button */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          height: 0.1 * height,
          borderRadius: 41,
          backgroundColor: theme.background.secondary,
          marginBottom: 20,
        }}
      >
        {/* Text lines inside bubble */}
        <View style={{ flex: 1, paddingLeft: 20, justifyContent: "center" }}>
          <Animated.View
            style={[
              {
                width: "70%",
                height: 18,
                borderRadius: 9,
                backgroundColor: theme.background.loading,
                marginBottom: 6,
              },
              pulseStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: "40%",
                height: 13,
                borderRadius: 7,
                backgroundColor: theme.background.loading,
              },
              pulseStyle,
            ]}
          />
        </View>
        {/* Return button placeholder */}
        <Animated.View
          style={[
            {
              width: 80,
              alignSelf: "stretch",
              borderRadius: 41,
              backgroundColor: theme.button.secondary,
              marginLeft: 10,
            },
            pulseStyle,
          ]}
        />
      </View>
      {/* orderSummary text */}
      <Animated.View
        style={[
          {
            width: "45%",
            height: 20,
            borderRadius: 10,
            backgroundColor: theme.background.loading,
            marginLeft: 20,
          },
          pulseStyle,
        ]}
      />
    </View>
  );
};

/** List of skeleton order items matching ordersList layout */
export const SkeletonOrderList = ({ count = 3 }: { count?: number }) => (
  <View
    style={{
      width: 0.88 * width,
      paddingHorizontal: 20,
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonOrderItem key={i} />
    ))}
  </View>
);

/** Skeleton matching order detail cart item (image + name/price/size + circle) */
export const SkeletonOrderDetailItem = () => {
  const { theme } = useTheme();
  const pulseStyle = usePulse();
  return (
    <View
      style={{
        backgroundColor: theme.surface.cartItem,
        borderRadius: 41,
        marginBottom: 15,
        paddingTop: 20,
        paddingLeft: 25,
        paddingRight: 20,
        paddingBottom: 15,
        flexDirection: "row",
        alignItems: "flex-start",
        justifyContent: "space-between",
      }}
    >
      <View
        style={{ flexDirection: "row", width: "80%", alignItems: "flex-start" }}
      >
        {/* Image placeholder */}
        <Animated.View
          style={[
            {
              width: "30%",
              aspectRatio: 0.75,
              borderRadius: 15,
              backgroundColor: theme.background.loading,
              marginRight: 15,
            },
            pulseStyle,
          ]}
        />
        {/* Text lines */}
        <View style={{ flex: 1, justifyContent: "flex-start" }}>
          <Animated.View
            style={[
              {
                width: "80%",
                height: 30,
                borderRadius: 10,
                backgroundColor: theme.background.loading,
                marginBottom: 8,
              },
              pulseStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: "40%",
                height: 16,
                borderRadius: 8,
                backgroundColor: theme.background.loading,
                marginBottom: 6,
              },
              pulseStyle,
            ]}
          />
          <Animated.View
            style={[
              {
                width: "20%",
                height: 14,
                borderRadius: 7,
                backgroundColor: theme.background.loading,
              },
              pulseStyle,
            ]}
          />
        </View>
      </View>
      {/* Circle placeholder */}
      <Animated.View
        style={[
          {
            width: 41,
            height: 41,
            borderRadius: 20.5,
            backgroundColor: theme.background.loading,
            marginTop: 10,
          },
          pulseStyle,
        ]}
      />
    </View>
  );
};

/** List of skeleton order detail items */
export const SkeletonOrderDetailList = ({ count = 2 }: { count?: number }) => (
  <View
    style={{
      width: width * 0.88,
      paddingHorizontal: 20,
    }}
  >
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonOrderDetailItem key={i} />
    ))}
  </View>
);

/** List of skeleton cart items */
export const SkeletonCartList = ({ count = 3 }: { count?: number }) => (
  <View style={{ padding: 16 }}>
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCartItem key={i} />
    ))}
  </View>
);

const CARD_WIDTH = (width * 0.88 - 42 - 14) / 2;

const createGridStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },
    card: {
      width: CARD_WIDTH,
      height: CARD_WIDTH,
      marginBottom: 14,
      borderRadius: Math.round(0.25 * CARD_WIDTH),
      backgroundColor: theme.button.disabled,
    },
  });

const createCartStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    cartItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: theme.surface.cartItem,
      borderRadius: 41,
      padding: 20,
      marginBottom: 15,
    },
    imagePlaceholder: {
      width: 80,
      height: 100,
      borderRadius: 15,
      backgroundColor: theme.background.loading,
    },
    textGroup: {
      flex: 1,
      marginLeft: 15,
      justifyContent: "flex-start",
    },
    textBar: {
      width: "60%",
      height: 20,
      borderRadius: 10,
      backgroundColor: theme.background.loading,
      marginBottom: 10,
    },
    textBarShort: {
      width: "35%",
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.background.loading,
      marginBottom: 8,
    },
    textBarTiny: {
      width: "25%",
      height: 12,
      borderRadius: 6,
      backgroundColor: theme.background.loading,
    },
  });
