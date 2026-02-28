import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
  PanResponder,
  Animated as RNAnimated,
  ActivityIndicator,
  Image as RNImage,
} from "react-native";
import { Image } from "expo-image";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import BackIcon from "../components/svg/BackIcon";
import Me from "../components/svg/Me";
import { ANIMATION_DURATIONS, ANIMATION_DELAYS } from "../lib/animations";
import * as Haptics from "expo-haptics";
import MeAlt from "../components/svg/MeAlt";
import {
  parseAvatarTransform,
  pixelsToTransform,
  transformToPixels,
} from "../types/avatar";
import { useTheme } from "../lib/ThemeContext";
import type { ThemeColors } from "../lib/theme";

const { width, height } = Dimensions.get("window");

// Constants for styles
const CROP_SIZE = width * 0.75;
const IMAGE_DISPLAY_SIZE = width * 0.85;

// Normalized crop in full image [0..1]: { nOriginX, nOriginY, nWidth, nHeight }
export type AvatarCropJson = string;

interface AvatarEditScreenProps {
  onBack: () => void;
  currentAvatar?: string | null;
  currentAvatarFull?: string | null;
  currentAvatarCrop?: string | null;
  /** Device-independent transform JSON: { scale, translateXPercent, translateYPercent } */
  currentAvatarTransform?: string | null;
  onSave: (
    avatarUrl: string,
    avatarUrlFull?: string | null,
    avatarCrop?: AvatarCropJson,
    avatarTransform?: string
  ) => void | Promise<void>;
}

const AvatarEditScreen: React.FC<AvatarEditScreenProps> = ({
  onBack,
  currentAvatar,
  currentAvatarFull,
  currentAvatarCrop,
  currentAvatarTransform,
  onSave,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [selectedImage, setSelectedImage] = useState<string | null>(
    currentAvatarFull || currentAvatar || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const scale = useRef(new RNAnimated.Value(1)).current;
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslate = useRef({ x: 0, y: 0 });

  const cropSize = CROP_SIZE;
  const imageDisplaySize = IMAGE_DISPLAY_SIZE;
  const containerWidth = cropSize;
  const containerHeight = cropSize;

  // Restore pan/zoom from device-independent transform (recompute pixels from container size).
  useEffect(() => {
    const transform = parseAvatarTransform(currentAvatarTransform);
    if (!selectedImage || !transform || selectedImage !== (currentAvatarFull || currentAvatar || null)) return;
    const { scale: s, translateX: tx, translateY: ty } = transformToPixels(
      transform,
      containerWidth,
      containerHeight
    );
    lastScale.current = s;
    lastTranslate.current = { x: tx, y: ty };
    scale.setValue(s);
    translateX.setValue(tx);
    translateY.setValue(ty);
  }, [currentAvatarFull, currentAvatar, currentAvatarTransform, selectedImage]);

  const pickImage = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert(
          "разрешение необходимо",
          "необходимо разрешение для доступа к фотографиям."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        // Reset transforms
        scale.setValue(1);
        translateX.setValue(0);
        translateY.setValue(0);
        lastScale.current = 1;
        lastTranslate.current = { x: 0, y: 0 };
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Ошибка", "Не удалось выбрать изображение.");
    }
  };

  // Calculate bounds for constraining image movement
  const getConstraints = (currentScale: number) => {
    const scaledSize = imageDisplaySize * currentScale;
    const maxX = Math.max(0, (scaledSize - cropSize) / 2);
    const maxY = Math.max(0, (scaledSize - cropSize) / 2);
    return { maxX, maxY };
  };

  // Track pinch gesture state
  const lastPinchDistance = useRef<number | null>(null);
  const pinchStartScale = useRef(1);

  // Pan responder for image manipulation with pinch-to-zoom
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        lastTranslate.current = {
          x: (translateX as any)._value,
          y: (translateY as any)._value,
        };
        lastScale.current = (scale as any)._value || 1;
        pinchStartScale.current = lastScale.current;
        lastPinchDistance.current = null;

        // If two touches, calculate initial distance
        if (evt.nativeEvent.touches.length === 2) {
          const touch1 = evt.nativeEvent.touches[0];
          const touch2 = evt.nativeEvent.touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
              Math.pow(touch2.pageY - touch1.pageY, 2)
          );
          lastPinchDistance.current = distance;
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;

        // Handle pinch-to-zoom with two fingers
        if (touches.length === 2) {
          const touch1 = touches[0];
          const touch2 = touches[1];
          const distance = Math.sqrt(
            Math.pow(touch2.pageX - touch1.pageX, 2) +
              Math.pow(touch2.pageY - touch1.pageY, 2)
          );

          if (lastPinchDistance.current !== null) {
            const scaleChange = distance / lastPinchDistance.current;
            const newScale = Math.max(
              1,
              Math.min(3, pinchStartScale.current * scaleChange)
            );

            // Constrain translation for new scale
            const constraints = getConstraints(newScale);
            const currentX = lastTranslate.current.x;
            const currentY = lastTranslate.current.y;

            const constrainedX = Math.max(
              -constraints.maxX,
              Math.min(constraints.maxX, currentX)
            );
            const constrainedY = Math.max(
              -constraints.maxY,
              Math.min(constraints.maxY, currentY)
            );

            scale.setValue(newScale);
            translateX.setValue(constrainedX);
            translateY.setValue(constrainedY);

            lastScale.current = newScale;
            lastTranslate.current = { x: constrainedX, y: constrainedY };
          } else {
            lastPinchDistance.current = distance;
          }
        } else if (touches.length === 1) {
          // Handle pan with single finger (only if not pinching)
          if (lastPinchDistance.current === null) {
            const currentScale = lastScale.current;
            const constraints = getConstraints(currentScale);

            // Calculate new position with constraints
            let newX = lastTranslate.current.x + gestureState.dx;
            let newY = lastTranslate.current.y + gestureState.dy;

            // Constrain movement to keep image within crop bounds
            newX = Math.max(
              -constraints.maxX,
              Math.min(constraints.maxX, newX)
            );
            newY = Math.max(
              -constraints.maxY,
              Math.min(constraints.maxY, newY)
            );

            translateX.setValue(newX);
            translateY.setValue(newY);
          }
        }
      },
      onPanResponderRelease: () => {
        lastTranslate.current = {
          x: (translateX as any)._value,
          y: (translateY as any)._value,
        };
        lastPinchDistance.current = null;
        pinchStartScale.current = lastScale.current;
      },
    })
  ).current;

  const handleConfirm = async () => {
    if (!selectedImage) {
      Alert.alert("ошибка", "пожалуйста, выберите изображение.");
      return;
    }

    let saveCalled = false;
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // ImageManipulator only accepts local URIs; download remote (e.g. existing S3 avatar) to cache first
      let imageUriForProcessing = selectedImage;
      const isRemote = selectedImage.startsWith("http://") || selectedImage.startsWith("https://");
      if (isRemote) {
        const localUri = `${FileSystem.cacheDirectory}avatar-edit-${Date.now()}.jpg`;
        await FileSystem.downloadAsync(selectedImage, localUri);
        imageUriForProcessing = localUri;
      }

      // Get original image dimensions
      const imageInfo = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          RNImage.getSize(
            imageUriForProcessing,
            (width, height) => resolve({ width, height }),
            (error) => reject(error)
          );
        }
      );

      const { width: originalWidth, height: originalHeight } = imageInfo;

      // Scale to fill crop circle
      const minDimension = Math.min(originalWidth, originalHeight);
      const scaleToFill = cropSize / minDimension;
      const scaledWidth = originalWidth * scaleToFill;
      const scaledHeight = originalHeight * scaleToFill;
      const resizeWidth = Math.max(cropSize, scaledWidth);
      const resizeHeight = Math.max(cropSize, scaledHeight);

      // Map view (tx, ty, userScale) to resized crop rect so the exported square matches the circle.
      // Display: image in wrapper (IMAGE_DISPLAY_SIZE) with cover + center; wrapper has transform [translateX, translateY, scale].
      const tx = lastTranslate.current.x;
      const ty = lastTranslate.current.y;
      const userScale = lastScale.current;
      const minDim = Math.min(originalWidth, originalHeight);

      // View center in resized image coords (what the user sees as center of the circle)
      const centerXResized =
        resizeWidth / 2 -
        (tx * minDim * resizeWidth) / (originalWidth * userScale * imageDisplaySize);
      const centerYResized =
        resizeHeight / 2 -
        (ty * minDim * resizeHeight) / (originalHeight * userScale * imageDisplaySize);

      // Visible content size: wrapper is IMAGE_DISPLAY_SIZE, scaled by userScale, clipped by circle (CROP_SIZE).
      // The scaled wrapper size is IMAGE_DISPLAY_SIZE * userScale.
      // The circle diameter is CROP_SIZE.
      // The visible square is the intersection: min(scaled wrapper, circle).
      // In wrapper coords (before scaling): visible = min(IMAGE_DISPLAY_SIZE * userScale, CROP_SIZE) / userScale
      // = min(IMAGE_DISPLAY_SIZE, CROP_SIZE / userScale)
      const scaledWrapperSize = imageDisplaySize * userScale;
      const visibleInWrapperCoords = Math.min(scaledWrapperSize, cropSize) / userScale;

      // Convert visible size from wrapper coords to resized image coords
      // Wrapper shows image with cover: scale = imageDisplaySize/minDim
      // So visible in original = visibleInWrapperCoords * minDim / imageDisplaySize
      // In resized: visibleW = that * (resizeWidth/origW), visibleH = that * (resizeHeight/origH)
      const visibleInResizedW =
        (visibleInWrapperCoords * minDim * resizeWidth) / (imageDisplaySize * originalWidth);
      const visibleInResizedH =
        (visibleInWrapperCoords * minDim * resizeHeight) / (imageDisplaySize * originalHeight);

      // Always capture exactly the visible square, then scale to 600x600 so output matches what user sees.
      const visibleSquare = Math.min(visibleInResizedW, visibleInResizedH);
      const cropSquareSize = Math.max(1, Math.min(resizeWidth, resizeHeight, Math.round(visibleSquare)));

      let originX = centerXResized - cropSquareSize / 2;
      let originY = centerYResized - cropSquareSize / 2;
      originX = Math.max(0, Math.min(resizeWidth - cropSquareSize, originX));
      originY = Math.max(0, Math.min(resizeHeight - cropSquareSize, originY));

      const cropRegion = {
        originX: Math.round(originX),
        originY: Math.round(originY),
        width: cropSquareSize,
        height: cropSquareSize,
      };

      // Higher-quality output: 600x600, 0.9 compression
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        imageUriForProcessing,
        [
          {
            resize: {
              width: Math.max(cropSize, Math.round(resizeWidth)),
              height: Math.max(cropSize, Math.round(resizeHeight)),
            },
          },
          {
            crop: cropRegion,
          },
          {
            resize: { width: 600, height: 600 },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Normalized crop in full image [0..1] for re-editing (pan out)
      const nOriginX = originX / resizeWidth;
      const nOriginY = originY / resizeHeight;
      const nWidth = cropSquareSize / resizeWidth;
      const nHeight = cropSquareSize / resizeHeight;
      const avatarCrop: AvatarCropJson = JSON.stringify({
        nOriginX,
        nOriginY,
        nWidth,
        nHeight,
      });

      // Device-independent transform for restore and for display on all screens
      const normalizedTransform = pixelsToTransform(
        userScale,
        tx,
        ty,
        containerWidth,
        containerHeight
      );
      const avatarTransform = JSON.stringify(normalizedTransform);

      const maxEdge = 1200;
      let fullLocalUri: string | null = null;
      if (
        !isRemote &&
        (imageUriForProcessing.startsWith("file://") || imageUriForProcessing.startsWith("file:"))
      ) {
        const { width: ow, height: oh } = imageInfo;
        const scaleFull = ow > oh ? maxEdge / ow : maxEdge / oh;
        const w = scaleFull >= 1 ? ow : Math.round(ow * scaleFull);
        const h = scaleFull >= 1 ? oh : Math.round(oh * scaleFull);
        const resized = await ImageManipulator.manipulateAsync(
          imageUriForProcessing,
          [{ resize: { width: w, height: h } }],
          { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
        );
        fullLocalUri = resized.uri;
      }

      saveCalled = true;
      await Promise.resolve(
        onSave(manipulatedImage.uri, fullLocalUri, avatarCrop, avatarTransform)
      );
    } catch (error) {
      console.error("Error saving avatar:", error);
      setIsLoading(false);
      if (!saveCalled) {
        Alert.alert("ошибка", "не удалось обработать изображение.");
      }
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={styles.backButton}
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.LARGE
        )}
      >
        <TouchableOpacity onPress={onBack} disabled={isLoading}>
          <BackIcon width={22} height={22} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
          ANIMATION_DELAYS.EXTENDED
        )}
        style={styles.content}
      >
        <View style={styles.imageContainerWrapper}>
          <View style={styles.imageContainer}>
            <View style={styles.cropArea}>
              {selectedImage ? (
                <RNAnimated.View
                  style={[
                    styles.imageWrapper,
                    {
                      transform: [{ translateX }, { translateY }, { scale }],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <Image
                    source={{ uri: selectedImage }}
                    style={styles.previewImage}
                    contentFit="cover"
                  />
                </RNAnimated.View>
              ) : (
                <View style={styles.placeholder}>
                  <MeAlt width={"100%"} height={"100%"} />
                </View>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.pickImageButton, isLoading && styles.buttonDisabled]}
          onPress={pickImage}
          disabled={isLoading}
        >
          <Text style={styles.pickImageButtonText}>
            {selectedImage ? "изменить фото" : "выбрать фото"}
          </Text>
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.confirmButton, isLoading && styles.buttonDisabled]}
            onPress={handleConfirm}
            disabled={!selectedImage || isLoading}
          >
            {isLoading ? (
              <View style={styles.confirmButtonLoading}>
                <ActivityIndicator size="small" color={theme.text.secondary} />
                <Text style={styles.confirmButtonText}>сохранение...</Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.confirmButtonText,
                  !selectedImage && styles.confirmButtonDisabledText,
                ]}
              >
                подтвердить
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: ThemeColors) =>
  StyleSheet.create({
    container: {
      width: "100%",
      height: "100%",
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: height * 0.05,
    },
    backButton: {
      position: "absolute",
      top: 0,
      left: 0,
      zIndex: 11,
    },
    content: {
      width: "100%",
      alignItems: "center",
      flex: 1,
      justifyContent: "space-between",
    },
    title: {
      fontFamily: "IgraSans",
      fontSize: 24,
      color: theme.text.primary,
      marginBottom: height * 0.05,
      textAlign: "center",
    },
    imageContainerWrapper: {
      width: "87%",
      justifyContent: "center",
      alignItems: "center",
    },
    imageContainer: {
      width: CROP_SIZE,
      height: CROP_SIZE,
      borderRadius: CROP_SIZE / 2,
      overflow: "hidden",
      backgroundColor: theme.surface.cartItem,
      justifyContent: "center",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    cropArea: {
      width: CROP_SIZE,
      height: CROP_SIZE,
      borderRadius: CROP_SIZE / 2,
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },
    imageWrapper: {
      width: IMAGE_DISPLAY_SIZE,
      height: IMAGE_DISPLAY_SIZE,
      justifyContent: "center",
      alignItems: "center",
    },
    previewImage: {
      width: IMAGE_DISPLAY_SIZE,
      height: IMAGE_DISPLAY_SIZE,
    },
    placeholder: {
      width: "100%",
      height: "100%",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.surface.cartItem,
    },
    pickImageButton: {
      backgroundColor: theme.surface.cartItem,
      borderRadius: 41,
      paddingHorizontal: 32,
      paddingVertical: 24,
      width: "81%",
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 6,
        },
      }),
    },
    pickImageButtonText: {
      fontFamily: "IgraSans",
      fontSize: 20,
      color: theme.text.primary,
    },
    buttonContainer: {
      width: "100%",
      alignItems: "flex-end",
    },
    confirmButton: {
      backgroundColor: theme.background.input,
      borderRadius: 41,
      paddingVertical: 12.5,
      paddingHorizontal: 25,
      alignItems: "center",
      ...Platform.select({
        ios: {
          shadowColor: theme.shadow.default,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
        },
        android: {
          elevation: 6,
          overflow: "hidden",
        },
      }),
    },
    confirmButtonText: {
      fontFamily: "IgraSans",
      fontSize: 20,
      color: theme.text.primary,
    },
    confirmButtonLoading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    confirmButtonDisabledText: {
      color: theme.text.primary,
      opacity: 0.37,
    },
  });

export default AvatarEditScreen;
