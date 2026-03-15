import type React from "react";
import { UIManager } from "react-native";

let ProgressiveBlurView: React.ComponentType<any> | null = null;
try {
  const hasNative =
    UIManager.getViewManagerConfig("ReactNativeProgressiveBlurView") != null;
  if (hasNative) {
    ProgressiveBlurView =
      require("@sbaiahmed1/react-native-blur").ProgressiveBlurView;
  }
} catch {
  // fallback: no blur
}

export { ProgressiveBlurView };
