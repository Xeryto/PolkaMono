import React, { useMemo } from "react";
import { View, StyleSheet, ViewStyle, Platform } from "react-native";
import Animated, {
  FadeInDown,
  FadeOutDown,
} from "react-native-reanimated";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
} from "../lib/animations";
import { Dimensions } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { height } = Dimensions.get("window");

interface RoundedBoxProps {
  children: React.ReactNode;
  backgroundColor?: string;
  borderRadius?: number;
  width?: string | number;
  height?: string | number;
  style?: ViewStyle;
  entering?: any;
  exiting?: any;
  shadowColor?: string;
  shadowOffset?: { width: number; height: number };
  shadowOpacity?: number;
  shadowRadius?: number;
  elevation?: number;
  zIndex?: number;
  overflow?: "visible" | "hidden";
}

const RoundedBox: React.FC<RoundedBoxProps> = ({
  children,
  backgroundColor,
  borderRadius = 41,
  width = "88%",
  height: heightProp,
  style,
  entering,
  exiting,
  shadowColor,
  shadowOffset = { width: 0, height: 4 },
  shadowOpacity = 0.25,
  shadowRadius = 4,
  elevation = 4,
  zIndex,
  overflow = "hidden",
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Use theme colors as defaults if not provided
  const finalBackgroundColor = backgroundColor || theme.background.primary;
  const finalShadowColor = shadowColor || theme.shadow.default;

  const defaultEntering = entering || FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
    ANIMATION_DELAYS.LARGE
  );
  const defaultExiting = exiting || FadeOutDown.duration(ANIMATION_DURATIONS.MICRO);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: finalBackgroundColor,
          borderRadius,
          width: width as any,
          height: heightProp as any,
          shadowColor: finalShadowColor,
          shadowOffset,
          shadowOpacity,
          shadowRadius,
          elevation,
          zIndex,
          overflow,
        },
        style,
      ]}
      entering={defaultEntering}
      exiting={defaultExiting}
    >
      {children}
    </Animated.View>
  );
};

const createStyles = (_theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: "relative",
    },
  });

export default RoundedBox;
