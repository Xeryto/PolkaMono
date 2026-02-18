import React from "react";
import { View, Image, StyleSheet, ViewStyle, ImageStyle } from "react-native";
import MeAlt from "./svg/MeAlt";
import { parseAvatarTransform, transformToPixels } from "../types/avatar";

/** Displays the user's avatar. When avatarTransform is provided (with avatarUrl or avatarUrlFull), applies device-independent transform so framing is consistent across screens and devices. */
export default function AvatarImage({
  avatarUrl,
  avatarUrlFull,
  avatarTransform,
  size = 80,
  style,
  imageStyle,
}: {
  /** Cropped avatar URL (preferred when present). */
  avatarUrl?: string | null;
  /** Full image URL; when used with avatarTransform, apply transform for consistent framing. */
  avatarUrlFull?: string | null;
  /** JSON: { scale, translateXPercent, translateYPercent }. Re-applied using container size. */
  avatarTransform?: string | null;
  size?: number;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
}) {
  const containerStyle = [
    styles.container,
    { width: size, height: size, borderRadius: size / 2 },
    style,
  ];

  const transform = parseAvatarTransform(avatarTransform);
  const hasFullAndTransform = !!(avatarUrlFull && transform);

  if (!avatarUrl && !avatarUrlFull) {
    return (
      <View style={containerStyle}>
        <MeAlt width={size * 0.6} height={size * 0.6} style={styles.fallback} />
      </View>
    );
  }

  // Prefer cropped avatar when present so the circle is always filled (crop is composed to fill 600x600).
  // Use full + transform only when we have no crop (e.g. legacy or re-edit before save).
  if (avatarUrl) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: avatarUrl }}
          style={[styles.image, imageStyle]}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (hasFullAndTransform) {
    const {
      scale: s,
      translateX: tx,
      translateY: ty,
    } = transformToPixels(transform, size, size);
    return (
      <View style={containerStyle}>
        <View
          style={[
            styles.transformWrapper,
            {
              width: size,
              height: size,
              transform: [{ translateX: tx }, { translateY: ty }, { scale: s }],
            },
          ]}
        >
          <Image
            source={{ uri: avatarUrlFull! }}
            style={[styles.image, imageStyle]}
            resizeMode="cover"
          />
        </View>
      </View>
    );
  }

  // Full image without transform (fallback)
  return (
    <View style={containerStyle}>
      <Image
        source={{ uri: avatarUrlFull! }}
        style={[styles.image, imageStyle]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2CCB2",
  },
  transformWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    margin: "auto",
  },
});
