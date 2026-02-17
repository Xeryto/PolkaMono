import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  FlatList,
  ImageBackground,
  Dimensions,
  Image,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";
import Logo from "../components/svg/Logo";
import BackIcon from "../components/svg/BackIcon";
import Scroll from "../components/svg/Scroll";
import * as api from "../services/api";
import {
  ANIMATION_DURATIONS,
  ANIMATION_DELAYS,
  ANIMATION_EASING,
} from "../lib/animations";
const { width, height } = Dimensions.get("window");
const LOGO_SIZE = Math.min(width, height) * 0.275;
const ITEM_WIDTH = width * 0.5; // Style item width slightly wider than 50%

// Style option interface
interface StyleOption {
  id: string;
  name: string;
  description: string;
}

interface StylesSelectionScreenProps {
  gender: "male" | "female";
  onComplete: (selectedStyles: string[]) => void | Promise<void>;
  onBack?: () => void;
  isSaving?: boolean;
}

const StylesSelectionScreen: React.FC<StylesSelectionScreenProps> = ({
  gender,
  onComplete,
  onBack,
  isSaving = false,
}) => {
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [showScrollHint, setShowScrollHint] = useState(true);
  const [stylesOptions, setStylesOptions] = useState<any[]>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch styles from API on mount
  useEffect(() => {
    setIsLoadingStyles(true);
    api
      .getStyles()
      .then((styleList: any[]) => {
        setStylesOptions(styleList);
        // Add a small delay to ensure smooth animation timing
        setTimeout(() => {
          setIsLoadingStyles(false);
        }, 100);
      })
      .catch((err) => {
        setStylesOptions([]);
        setIsLoadingStyles(false);
      });
  }, []);

  // Filter style options based on gender preference if needed
  const styleOptions =
    gender === "female"
      ? stylesOptions
      : stylesOptions.filter(
          (style) => !["romantic", "bohemian"].includes(style.id)
        );

  const handleStyleSelect = (id: string) => {
    setSelectedStyles((prev) => {
      // If style is already selected, remove it
      if (prev.includes(id)) {
        return prev.filter((styleId) => styleId !== id);
      }
      // Otherwise add it (limited to max 2 styles)
      else if (prev.length < 2) {
        return [...prev, id];
      }
      return prev;
    });
  };

  const showSaving = isSubmitting || isSaving;

  const handleContinue = async () => {
    setIsSubmitting(true);
    try {
      await Promise.resolve(onComplete(selectedStyles));
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert(
        "ошибка",
        "не удалось сохранить любимые стили. попробуйте еще раз."
      );
    }
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Hide scroll hint when user starts scrolling
    if (event.nativeEvent.contentOffset.y > 5 && showScrollHint) {
      setShowScrollHint(false);
    }
  };

  const renderStyleItem = ({
    item,
    index,
  }: {
    item: StyleOption;
    index: number;
  }) => {
    // Alternate alignment for chess board pattern
    const isEven = index % 2 === 0;

    return (
      <View
        style={[
          styles.styleItemContainer,
          isEven ? styles.alignLeft : styles.alignRight,
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.styleItem,
            selectedStyles.includes(item.id) && styles.selectedStyleItem,
            pressed && styles.pressedStyleItem,
          ]}
          onPress={() => handleStyleSelect(item.id)}
          android_ripple={{
            color: "rgba(205, 166, 122, 0.3)",
            borderless: false,
          }}
        >
          <View style={styles.styleOverlay}>
            <Text
              style={[
                styles.styleName,
                selectedStyles.includes(item.id) && styles.styleNameSelected,
              ]}
            >
              {item.name}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={["#FAE9CF", "#CCA479", "#CDA67A", "#6A462F"]}
      locations={[0, 0.34, 0.5, 0.87]}
      style={styles.container}
      start={{ x: 0, y: 0.2 }}
      end={{ x: 1, y: 0.8 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          style={styles.roundedBox}
          entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
        >
          <LinearGradient
            colors={["rgba(205, 166, 122, 0.5)", "transparent"]}
            start={{ x: 0.1, y: 1 }}
            end={{ x: 0.9, y: 0.3 }}
            locations={[0.05, 1]}
            style={styles.gradientBackground}
          />
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <BackIcon width={22} height={22} />
          </TouchableOpacity>
          <View style={styles.formContainerShadow}>
            <Animated.View
              entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
              style={styles.formContainer}
            >
              <View style={styles.logoContainer}>
                <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
              </View>

              {/* Selected styles counter */}
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.MICRO
                )}
                style={styles.counterContainer}
              >
                <Text style={styles.counterText}>
                  {selectedStyles.length}/2
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.SMALL
                )}
                style={styles.stylesContainer}
              >
                {showScrollHint && (
                  <Animated.View
                    entering={FadeIn.duration(ANIMATION_DURATIONS.MEDIUM)}
                    exiting={FadeOut.duration(ANIMATION_DURATIONS.STANDARD)}
                    style={styles.scrollHintContainer}
                  >
                    <Text style={styles.scrollHintText}>листай</Text>
                    <Scroll width={26} height={26} />
                  </Animated.View>
                )}

                {isLoadingStyles ? (
                  <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>загрузка стилей...</Text>
                  </View>
                ) : (
                  <FlatList
                    data={styleOptions}
                    renderItem={renderStyleItem}
                    keyExtractor={(item) => item.id}
                    numColumns={1}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    style={styles.stylesList}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={8}
                  />
                )}
              </Animated.View>
              <Animated.View
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM).delay(
                  ANIMATION_DELAYS.STANDARD
                )}
                style={styles.buttonContainer}
              >
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinue}
                  disabled={showSaving}
                >
                  {showSaving ? (
                    <View style={styles.continueButtonLoading}>
                      <ActivityIndicator
                        size="small"
                        color="#6A462F"
                      />
                      <Text style={styles.continueButtonText}>
                        сохранение...
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.continueButtonText}>продолжить</Text>
                  )}
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </View>
          <Animated.View style={styles.textContainer}>
            <Text style={styles.text}>СТИЛЬ</Text>
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 0 : 30,
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
  backButton: {
    position: "absolute",
    top: 21,
    left: 21,
    zIndex: 10,
    width: 33,
    height: 33,
  },
  formContainerShadow: {
    top: -3,
    left: -3,
    width: width * 0.88,
    height: "90%",
    borderRadius: 41,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  formContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    padding: 21,
    alignItems: "center",
    ...Platform.select({
      android: {
        overflow: "hidden",
      },
    }),
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  counterContainer: {
    marginBottom: 15,
    alignItems: "center",
  },
  counterText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    color: "#000",
    textAlign: "center",
  },
  scrollHintContainer: {
    position: "absolute",
    bottom: -5,
    right: 0,
    alignItems: "flex-end",
    zIndex: 10,
    paddingVertical: 8,
    flexDirection: "row",
  },
  scrollHintText: {
    fontFamily: "IgraSans",
    fontSize: 14,
    lineHeight: 26,
    color: "#000",
    flexDirection: "row",
    alignItems: "center",
  },
  stylesContainer: {
    width: "100%",
    height: height * 0.375 + 30 + 10,
    position: "relative",
  },
  stylesList: {
    borderRadius: 41,
    //paddingBottom: 10,
  },
  styleItemContainer: {
    width: "100%",
    alignItems: "flex-start",
    marginBottom: 15,
  },
  alignLeft: {
    alignItems: "flex-start",
  },
  alignRight: {
    alignItems: "flex-end",
  },
  styleItem: {
    width: "55%",
    height: height * 0.125,
    marginHorizontal: 5,
    borderRadius: 41,
    backgroundColor: "#E0D6CC",
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
  pressedStyleItem: {
    opacity: 0.8,
  },
  selectedStyleItem: {
    backgroundColor: "#9A7859",
  },
  buttonPressed: {
    opacity: 0.8,
  },
  styleOverlay: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  styleName: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
    textAlign: "center",
    marginBottom: 4,
  },
  styleNameSelected: {
    color: "#E0D6CC",
  },
  styleDescription: {
    fontFamily: "REM",
    fontSize: 10,
    color: "#4A3120",
    textAlign: "center",
    opacity: 0.8,
  },
  checkmarkContainer: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#4A3120",
    justifyContent: "center",
    alignItems: "center",
  },
  checkmark: {
    color: "#FFF",
    fontSize: 14,
  },
  selectedCount: {
    marginTop: 12,
    marginBottom: 16,
  },
  selectedCountText: {
    fontFamily: "REM",
    fontSize: 14,
    color: "#4A3120",
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "flex-end",
  },
  continueButton: {
    marginTop: height * 0.05,
    backgroundColor: "#E0D6CC",
    borderRadius: 41,
    paddingVertical: 16,
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
  continueButtonText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
  continueButtonLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    marginBottom: 18,
    marginLeft: 27,
  },
  text: {
    fontFamily: "IgraSans",
    fontSize: 38,
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
  },
  loadingText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#000",
  },
});

export default StylesSelectionScreen;
