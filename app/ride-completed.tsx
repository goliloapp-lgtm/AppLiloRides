import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useRideStore,
  useLocationStore,
  useDriverStore,
  useRouteStore,
  usePaymentStore,
} from "../store";
import { useStripe } from "@stripe/stripe-react-native";
import { useAuth } from "../lib/context/AuthContext";
import { useProfile } from "../lib/context/ProfileContext";
import { getSupportContactNumber } from "../lib/support";
import { ScrollView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import CustomButton from "../components/CustomButton";
import ReactNativeModal from "react-native-modal";
import { serverTimestamp, doc, setDoc } from "firebase/firestore";
import { db } from "../firebase-config";
import { fetchAPI } from "../lib/utils";
import { useTranslation } from "../hooks/useTranslation";
import { KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";

export default function RideCompleted() {
  const router = useRouter();
  const searchParams = useLocalSearchParams();
  const { clearActiveRide, setCustomerId, activeRide } = useRideStore();
  const { user } = useAuth();
  const { profileData } = useProfile();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { t } = useTranslation("completed");

  // Extract router search params
  const rideId = (searchParams.rideId as string) || null;
  const driverId = (searchParams.driverId as string) || null;
  const paymentMethod = (searchParams.paymentMethod as string) || null;
  const fare = parseFloat(searchParams.fare as string) || 0;

  const [rating, setRating] = useState(0);
  const [review, setReview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTipModalVisible, setTipModalVisible] = useState(false);
  const [tipAmount, setTipAmount] = useState("");
  const [isTipping, setIsTipping] = useState(false);
  const [tipSuccess, setTipSuccess] = useState(false);

  const handleRating = (rate: number) => {
    setRating(rate);
  };

  const handleContactSupport = async () => {
    try {
      const supportNumber = await getSupportContactNumber();
      Linking.openURL(`tel:${supportNumber}`);
    } catch (error) {
      console.error("Error opening support contact:", error);
      Linking.openURL("tel:+16787378687");
    }
  };

  const resetFlow = () => {
    const { clearSelectedDriver, setDrivers } = useDriverStore.getState();
    const { clearRouteInfo } = useRouteStore.getState();
    const { clearDestinationLocation } = useLocationStore.getState();
    const { setPaymentMethod } = usePaymentStore.getState();

    clearActiveRide();
    clearDestinationLocation();
    clearSelectedDriver();
    setDrivers([]);
    clearRouteInfo();
    setPaymentMethod(null);
    router.replace("/(tabs)/home");
  };

  const handleSubmit = async () => {
    if (rating === 0) {
      Toast.show({
        type: "error",
        text1: t("alerts.ratingRequired"),
        text2: t("alerts.ratingRequiredMessage"),
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const ratingData = {
        userId: user?.uid,
        driverId: driverId ?? activeRide?.driverId ?? null,
        rideId: rideId ?? null,
        rating: rating,
        review: review || null,
        reviewTimestamp: serverTimestamp(),
      };

      // Guard: never write undefined values to Firestore
      Object.keys(ratingData).forEach((key) => {
        if ((ratingData as any)[key] === undefined) (ratingData as any)[key] = null;
      });

      if (rideId) {
        const rideRef = doc(db, "historyTrips", rideId);
        await setDoc(rideRef, ratingData, { merge: true });
      } else {
        console.warn("No rideId found to save review");
      }

      Toast.show({
        type: "success",
        text1: t("toasts.feedbackSubmitted"),
        text2: t("toasts.thankYouFeedback"),
      });
      if (!tipSuccess) {
        resetFlow();
      }
    } catch (error) {
      console.error("Failed to submit review:", error);
      Toast.show({
        type: "error",
        text1: t("toasts.submissionError"),
        text2: t("toasts.couldNotSubmit"),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayTip = async () => {
    const tipValue = parseFloat(tipAmount);
    if (isNaN(tipValue) || tipValue <= 0) {
      Alert.alert(t("alerts.invalidAmount"), t("alerts.invalidAmountMessage"));
      return;
    }

    setIsTipping(true);

    try {
      const { paymentIntent, ephemeralKey, customer } = await fetchAPI(
        "/api/stripe/createApi",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:
              profileData?.fullName ||
              user?.displayName ||
              user?.email?.split("@")[0],
            email: user?.email,
            amount: tipValue,
          }),
        },
      );

      if (!paymentIntent?.client_secret) {
        throw new Error("No payment intent returned from server");
      }

      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: "Lilo Rides",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey?.secret,
        paymentIntentClientSecret: paymentIntent?.client_secret,
        allowsDelayedPaymentMethods: true,
      });

      if (initError) {
        throw new Error(initError.message || "Failed to init payment sheet");
      }

      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User cancelled
      } else {
        setCustomerId(customer);

        if (rideId) {
          const rideRef = doc(db, "historyTrips", rideId);
          await setDoc(rideRef, { 
            tip: tipValue,
            userId: user?.uid,
            driverId: driverId ?? activeRide?.driverId ?? null,
            rideId: rideId ?? null,
          }, { merge: true });
        }

        setTipSuccess(true);
        Toast.show({
          type: "success",
          text1: t("toasts.tipPaid"),
          text2: t("toasts.successfullyTipped", { amount: tipValue }),
        });
        setTipModalVisible(false);
      }
    } catch (error: any) {
      console.error("Tip payment error:", error);
      Alert.alert(t("alerts.paymentFailed"), error.message);
    } finally {
      setIsTipping(false);
    }
  };

  const selectTipPercentage = (percentage: number) => {
    const tip = (fare * percentage) / 100;
    setTipAmount(tip.toFixed(2));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}>
      <View className="flex-1 bg-gray-100 py-12">
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 20,
            paddingTop: 32,
            paddingBottom: 32,
          }}
          showsVerticalScrollIndicator={false}>
          <View className="flex-1">
            <View className="flex-row items-center justify-center mb-5">
              <Image
                source={require("../assets/icons/check.png")}
                className="w-40 h-40 mt-5"
              />
            </View>
            <Text className="text-3xl font-bold text-center mb-6">
              {t("title")}
            </Text>
            {paymentMethod === "card" ? (
              <Text className="text-center text-gray-600 mb-8">
                {t("cardCharged")}
              </Text>
            ) : (
              <Text className="text-center text-gray-600 mb-8">
                {t("thankYou")}
              </Text>
            )}

            <View className="bg-white shadow p-5 rounded-lg mb-8">
              <Text className="text-lg font-bold text-center mb-3">
                {t("rateDriver")}
              </Text>
              <View className="flex-row justify-center items-center mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => handleRating(star)}
                    className="p-2">
                    <Ionicons
                      name={star <= rating ? "star" : "star-outline"}
                      size={36}
                      color={star <= rating ? "#FFD700" : "#C0C0C0"}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-lg font-bold text-center mb-3">
                {t("leaveReview")}
              </Text>
              <TextInput
                value={review}
                onChangeText={setReview}
                placeholder={t("reviewPlaceholder")}
                className="bg-white h-24 p-3 border border-gray-300 rounded-lg text-base"
                multiline
                textAlignVertical="top"
              />
              <View className="mt-5" />
              <CustomButton
                title={isSubmitting ? t("submitting") : t("submitFeedback")}
                onPress={handleSubmit}
                disabled={isSubmitting}
              />
            </View>
          </View>

          <View className="gap-y-4 ">
            {!tipSuccess && (
              <TouchableOpacity onPress={() => setTipModalVisible(true)}>
                <View className="bg-green-500 w-full rounded-lg py-3">
                  <Text className="text-white text-xl text-center font-bold">
                    {t("addTip")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={resetFlow}>
              <View className="bg-transparent border border-secondary w-full rounded-lg  py-3">
                <Text className="text-secondary text-xl text-center font-bold">
                  {t("goHome")}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleContactSupport} className="mt-4">
              <Text className="text-center text-gray-500 underline">
                {t("contactSupport")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        <ReactNativeModal
          isVisible={isTipModalVisible}
          onBackdropPress={() => setTipModalVisible(false)}>
          <View className="bg-white p-6 rounded-lg">
            <Text className="text-2xl font-bold text-center mb-4">
              {t("tipModal.title")}
            </Text>
            <View className="flex-row justify-around mb-4">
              {[15, 18, 20].map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => selectTipPercentage(p)}
                  className="bg-gray-200 px-4 py-2 rounded-full">
                  <Text className="font-bold">{p}%</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              placeholder={t("tipModal.enterCustomAmount")}
              keyboardType="numeric"
              value={tipAmount}
              onChangeText={setTipAmount}
              className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-center text-xl mb-4"
            />
            <CustomButton
              title={
                isTipping ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  t("tipModal.payTip", { amount: tipAmount })
                )
              }
              onPress={handlePayTip}
              disabled={isTipping || !tipAmount}
            />
          </View>
        </ReactNativeModal>
      </View>
    </KeyboardAvoidingView>
  );
}
