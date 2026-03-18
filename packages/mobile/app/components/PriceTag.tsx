import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";
import { getEffectivePrice, formatPrice } from "../lib/swipeCardUtils";

interface PriceTagProps {
  price: number;
  sale_price?: number | null;
  sale_type?: "percent" | "exact" | null;
  compact?: boolean;
}

const PriceTag = ({ price, sale_price, sale_type, compact }: PriceTagProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme, compact), [theme, compact]);

  const displayPrice = getEffectivePrice({ price, sale_price, sale_type });

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

  const translateX = 0;
  const translateY = isMeasured ? -TEXT_LENGTH / 2 : 0;

  return (
    <View
      style={[
        styles.priceContainer,
        {
          position: "absolute",
          right: 0,
          top: compact ? "50%" : 0,
          width: isMeasured ? TEXT_HEIGHT : 200,
          height: isMeasured ? TEXT_LENGTH : 100,
          transform: [{ translateX: translateX }, { translateY: translateY }],
          overflow: compact ? "hidden" : "visible",
        },
      ]}
    >
      {!isMeasured && (
        <Text onLayout={handleTextLayout} style={styles.priceText}>
          {`${formatPrice(displayPrice)} \u20BD`}
        </Text>
      )}
      {isMeasured && (
        <Text
          style={[
            styles.priceText,
            {
              width: TEXT_LENGTH,
              height: TEXT_HEIGHT,
              // overflow: "visible",
              transform: [{ rotate: "90deg" }],
            },
          ]}
        >
          {`${formatPrice(displayPrice)} \u20BD`}
        </Text>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeColors, compact?: boolean) =>
  StyleSheet.create({
    priceContainer: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: compact ? 0.15 : 0.25,
      shadowRadius: 4,
    },
    priceText: {
      fontFamily: "REM",
      fontSize: compact ? 12 : 14,
      color: theme.text.secondary,
      paddingHorizontal: compact ? 6 : 8,
      paddingVertical: compact ? 3 : 4,
    },
  });

export default PriceTag;
