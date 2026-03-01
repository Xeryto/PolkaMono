import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";
import { getEffectivePrice, formatPrice } from "../lib/swipeCardUtils";

interface PriceTagProps {
  price: number;
  sale_price?: number | null;
  sale_type?: "percent" | "exact" | null;
}

const PriceTag = ({ price, sale_price, sale_type }: PriceTagProps) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
              overflow: "visible",
              transform: [
                { rotate: "90deg" },
                { translateX: -OFFSET },
                { translateY: OFFSET },
              ],
            },
          ]}
        >
          {`${formatPrice(displayPrice)} \u20BD`}
        </Text>
      )}
    </View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    priceContainer: {
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      shadowColor: theme.shadow.default,
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    priceText: {
      fontFamily: "REM",
      fontSize: 14,
      color: theme.text.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
  });

export default PriceTag;
