import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  Platform,
  PanResponder,
  Animated as RNAnimated,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import BackIcon from "../components/svg/BackIcon";
import Me from "../components/svg/Me";
import { ANIMATION_DURATIONS, ANIMATION_DELAYS } from "../lib/animations";
import * as Haptics from "expo-haptics";
import MeAlt from "../components/svg/MeAlt";

const { width, height } = Dimensions.get("window");

// Constants for styles
const CROP_SIZE = width * 0.75;
const IMAGE_DISPLAY_SIZE = width * 0.85;

interface AvatarEditScreenProps {
  onBack: () => void;
  currentAvatar?: string | null;
  onSave: (avatarUri: string) => void;
}

const AvatarEditScreen: React.FC<AvatarEditScreenProps> = ({
  onBack,
  currentAvatar,
  onSave,
}) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(
    currentAvatar || null
  );
  const [isLoading, setIsLoading] = useState(false);
  const scale = useRef(new RNAnimated.Value(1)).current;
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const lastScale = useRef(1);
  const lastTranslate = useRef({ x: 0, y: 0 });

  const cropSize = CROP_SIZE; // Size of the crop area (circular)
  const imageDisplaySize = IMAGE_DISPLAY_SIZE; // Display size of the image

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

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Get original image dimensions
      const imageInfo = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          Image.getSize(
            selectedImage,
            (width, height) => resolve({ width, height }),
            (error) => reject(error)
          );
        }
      );

      const { width: originalWidth, height: originalHeight } = imageInfo;

      // Calculate scale to ensure image covers the crop circle (minimum dimension must cover cropSize)
      // We want to crop a square that's at least cropSize, ensuring the circle is always filled
      const minDimension = Math.min(originalWidth, originalHeight);
      const scaleToFill = cropSize / minDimension;
      const scaledWidth = originalWidth * scaleToFill;
      const scaledHeight = originalHeight * scaleToFill;

      // Calculate crop region from center of scaled image
      // Crop a square from the center that ensures the circle is filled
      const cropDimension = Math.min(scaledWidth, scaledHeight);
      const cropOriginX = (scaledWidth - cropDimension) / 2;
      const cropOriginY = (scaledHeight - cropDimension) / 2;

      // First resize to ensure we have enough pixels, then crop
      const resizeWidth = Math.max(cropSize, scaledWidth);
      const resizeHeight = Math.max(cropSize, scaledHeight);

      // Crop from center to ensure circle is filled
      const cropRegion = {
        originX: Math.max(0, (resizeWidth - cropSize) / 2),
        originY: Math.max(0, (resizeHeight - cropSize) / 2),
        width: cropSize,
        height: cropSize,
      };

      // Manipulate image: resize first to ensure minimum size, then crop center square
      const manipulatedImage = await ImageManipulator.manipulateAsync(
        selectedImage,
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
            resize: { width: 300, height: 300 },
          },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      onSave(manipulatedImage.uri);
    } catch (error) {
      console.error("Error processing image:", error);
      Alert.alert("ошибка", "не удалось обработать изображение.");
    } finally {
      setIsLoading(false);
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
        <TouchableOpacity onPress={onBack}>
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
                    resizeMode="cover"
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

        <TouchableOpacity style={styles.pickImageButton} onPress={pickImage}>
          <Text style={styles.pickImageButtonText}>
            {selectedImage ? "изменить фото" : "выбрать фото"}
          </Text>
        </TouchableOpacity>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            disabled={!selectedImage || isLoading}
          >
            <Text
              style={[
                styles.confirmButtonText,
                (!selectedImage || isLoading) &&
                  styles.confirmButtonDisabledText,
              ]}
            >
              {isLoading ? "сохранение..." : "подтвердить"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
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
    color: "#000",
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
    backgroundColor: "#E2CCB2",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    backgroundColor: "#E2CCB2",
  },
  pickImageButton: {
    backgroundColor: "#E2CCB2",
    borderRadius: 41,
    paddingHorizontal: 32,
    paddingVertical: 24,
    width: "81%",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    color: "#000",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "flex-end",
  },
  confirmButton: {
    backgroundColor: "#E0D6CC",
    borderRadius: 41,
    paddingVertical: 12.5,
    paddingHorizontal: 25,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
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
    color: "#000",
  },
  confirmButtonDisabledText: {
    color: "#000",
    opacity: 0.37,
  },
});

export default AvatarEditScreen;
