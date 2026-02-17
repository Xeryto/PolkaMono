import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import Logo from "../components/svg/Logo";
import BackIcon from "../components/svg/BackIcon";
import { ANIMATION_DURATIONS, ANIMATION_DELAYS } from "../lib/animations";

const { width, height } = Dimensions.get("window");

interface ConfirmationScreenProps {
  onComplete: (choice: "male" | "female") => void | Promise<void>;
  onBack?: () => void;
}

const LOGO_SIZE = Math.min(width, height) * 0.275; // 25% of the smallest dimension

const ConfirmationScreen: React.FC<ConfirmationScreenProps> = ({
  onComplete,
  onBack,
}) => {
  const [selectedOption, setSelectedOption] = useState<
    "male" | "female" | null
  >(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOptionSelect = async (option: "male" | "female") => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedOption(option);
    setIsSubmitting(true);
    try {
      await Promise.resolve(onComplete(option));
    } catch (error) {
      setIsSubmitting(false);
      Alert.alert("ошибка", "не удалось сохранить пол. попробуйте еще раз.");
    }
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
          <Animated.View style={styles.formContainerShadow}>
            <View style={styles.formContainer}>
              {/* Main content: logo and buttons in a row with space-between */}
              <Animated.View
                style={styles.formContentRow}
                entering={FadeInDown.duration(ANIMATION_DURATIONS.MEDIUM)}
              >
                <View style={styles.logoContainer}>
                  <Logo width={LOGO_SIZE} height={LOGO_SIZE} />
                </View>

                <View style={styles.buttonsRow}>
                  <Animated.View
                    entering={FadeInDown.duration(
                      ANIMATION_DURATIONS.MEDIUM,
                    ).delay(ANIMATION_DELAYS.SMALL)}
                    style={[
                      styles.buttonShadow,
                      isSubmitting &&
                        selectedOption !== "male" &&
                        styles.buttonDimmed,
                    ]}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.optionButton,
                        selectedOption === "male" && styles.selectedButtonM,
                        pressed && styles.buttonPressed,
                        { backgroundColor: "#E0D6CC" },
                      ]}
                      onPress={() => handleOptionSelect("male")}
                      android_ripple={{
                        color: "#CCA479",
                        borderless: false,
                        radius: 41,
                      }}
                      disabled={isSubmitting}
                    >
                      <Text
                        style={[
                          styles.optionButtonTextM,
                          selectedOption === "male" &&
                            styles.selectedButtonTextM,
                        ]}
                      >
                        М
                      </Text>
                    </Pressable>
                  </Animated.View>

                  <Animated.View
                    entering={FadeInDown.duration(
                      ANIMATION_DURATIONS.MEDIUM,
                    ).delay(ANIMATION_DELAYS.SMALL)}
                    style={[
                      styles.buttonShadow,
                      isSubmitting &&
                        selectedOption !== "female" &&
                        styles.buttonDimmed,
                    ]}
                  >
                    <Pressable
                      style={({ pressed }) => [
                        styles.optionButton,
                        selectedOption === "female" && styles.selectedButtonF,
                        pressed && styles.buttonPressed,
                        { backgroundColor: "#9A7859" },
                      ]}
                      onPress={() => handleOptionSelect("female")}
                      android_ripple={{
                        color: "#CCA479",
                        borderless: false,
                        radius: 41,
                      }}
                      disabled={isSubmitting}
                    >
                      {selectedOption === "female" && isSubmitting ? (
                        <ActivityIndicator size="small" color="#E0D6CC" />
                      ) : (
                        <Text
                          style={[
                            styles.optionButtonTextF,
                            selectedOption === "female" &&
                              styles.selectedButtonTextF,
                          ]}
                        >
                          Ж
                        </Text>
                      )}
                    </Pressable>
                  </Animated.View>
                </View>
              </Animated.View>

              {/* Saving text at bottom of white box (absolute) */}
              {isSubmitting && (
                <View style={styles.savingContainer}>
                  <ActivityIndicator size="small" color="#4A3120" />
                  <Text style={styles.savingText}>сохранение...</Text>
                </View>
              )}
            </View>
          </Animated.View>
          <Animated.View style={styles.textContainer}>
            <Text style={styles.text}>ПОЛ</Text>
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
    paddingTop: Platform.OS === "android" ? 20 : 0,
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
    top: 20,
    left: 20,
    zIndex: 10,
    width: 33,
    height: 33,
  },
  formContainerShadow: {
    width: width * 0.88,
    top: -3,
    left: -3,
    height: "90%",
    borderRadius: 41,
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
  formContainer: {
    width: "100%",
    height: "100%",
    flexDirection: "column",
    backgroundColor: "#F2ECE7",
    borderRadius: 41,
    ...Platform.select({
      android: {
        overflow: "hidden",
      },
    }),
  },
  formContentRow: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
    position: "absolute",
    top: height * 0.03,
    left: width / 2 - LOGO_SIZE / 2,
    right: width / 2 - LOGO_SIZE / 2,
  },
  buttonShadow: {
    borderRadius: 41,
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
  optionButton: {
    width: 99,
    height: 99,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      android: {
        overflow: "hidden",
      },
    }),
  },
  buttonPressed: {
    opacity: 0.8,
  },
  selectedButtonM: {
    backgroundColor: "#4A3120",
  },
  selectedButtonF: {
    backgroundColor: "#9A7859",
  },
  optionButtonTextM: {
    fontFamily: "IgraSans",
    fontSize: 40,
    color: "#9A7859",
  },
  optionButtonTextF: {
    fontFamily: "IgraSans",
    fontSize: 40,
    color: "#E0D6CC",
  },
  selectedButtonTextM: {
    color: "#9A7859",
  },
  selectedButtonTextF: {
    color: "#E0D6CC",
  },
  buttonsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    width: "100%",
  },
  buttonDimmed: {
    opacity: 0.5,
  },
  savingContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: "rgba(106, 70, 47, 0.15)",
    backgroundColor: "rgba(242, 236, 231, 0.98)",
    borderRadius: 41,
  },
  savingText: {
    fontFamily: "IgraSans",
    fontSize: 20,
    color: "#4A3120",
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
});

export default ConfirmationScreen;
