import React, { useState, useEffect } from "react";
import { View, Image, ActivityIndicator } from "react-native";
import CustomButton from "./CustomButton";
import { PaymentSheetError, useStripe } from "@stripe/stripe-react-native";
import { useAuth } from "../lib/context/AuthContext";
import { useProfile } from "../lib/context/ProfileContext";
import { ReactNativeModal } from "react-native-modal";
import { Text } from "react-native";
import { Platform } from "react-native";
import Constants from "expo-constants";
import Toast from "react-native-toast-message";
import { useLocationStore, useRideStore, useRouteStore } from "../store";
import { createRideRequest, subscribeRideRequest, updateRideStatus } from "../lib/realtime";
import { fetchAPI } from "../lib/utils";
import { useTranslation } from "../hooks/useTranslation";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase-config";

// Non-blocking helper: sends push notification to driver after ride is created.
// Failures here must never block the passenger from booking a ride.
const notifyDriverPush = async (payload) => {
  try {
    const fn = httpsCallable(functions, 'notifyDriverNewRide');
    await fn(payload);
    console.log('[Notifications] notifyDriverNewRide sent successfully');
  } catch (e) {
    console.warn('[Notifications] notifyDriverNewRide failed (non-critical):', e?.message);
  }
};

// Non-blocking helper: notifies the driver that the passenger cancelled the ride.
const notifyDriverCancelPush = async (payload) => {
  try {
    const fn = httpsCallable(functions, 'notifyDriverRideCancelled');
    await fn(payload);
    console.log('[Notifications] notifyDriverRideCancelled sent successfully');
  } catch (e) {
    console.warn('[Notifications] notifyDriverRideCancelled failed (non-critical):', e?.message);
  }
};

export default function PaymentButton(props) {
  const { paymentMethod, amount, driverId, rideTime, setActiveSheet, navigation } = props;
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { t } = useTranslation("common");
  
  const activeRide = useRideStore((state) => state.activeRide);
  const routeInfo = useRouteStore((state) => state.routeInfo);

  // Convert route distance from km to miles (MapViewDirections returns km)
  // 1 km = 0.621371 miles
  const distanceMiles = routeInfo?.distance
    ? parseFloat((routeInfo.distance * 0.621371).toFixed(2))
    : undefined;

  // Correct state declarations
  const [isWaitingModalVisible, setWaitingModalVisible] = useState(() => {
    return activeRide?.status === "requested";
  });
  const [isCancelConfirmModalVisible, setCancelConfirmModalVisible] = useState(false); // This was missing
  const [rideId, setRideId] = useState(() => {
    return activeRide?.status === "requested" ? activeRide.id : null;
  });
  const [paymentIntentId, setPaymentIntentId] = useState(() => {
    return activeRide?.status === "requested" ? activeRide.paymentIntentId : null;
  });
  const [showCancelButton, setShowCancelButton] = useState(() => {
    return activeRide?.status === "requested";
  });
  const [isCancelling, setIsCancelling] = useState(false);

  const { user } = useAuth();
  const { profileData } = useProfile();
  const {
    userAddress,
    destinationAddress,
    userLatitude,
    userLongitude,
    destinationLatitude,
    destinationLongitude,
  } = useLocationStore();
  const setCustomerId = useRideStore((state) => state.setCustomerId);

  

  const initializePaymentSheet = async () => {
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
              user?.email.split("@")[0],
            email: user?.email,
            amount: amount,
          }),
        }
      );

    

      setCustomerId(customer); // Save customer ID to the store

      const { error } = await initPaymentSheet({
        merchantDisplayName: "Lilo Rides",
        customerId: customer,
        customerEphemeralKeySecret: ephemeralKey?.secret,
        paymentIntentClientSecret: paymentIntent?.client_secret,
        allowsDelayedPaymentMethods: true,
        returnURL: "lilo://book-ride",
      });
      if (error) {
        console.log("initPaymentSheet error", error);
        throw new Error(error.message || "Failed to init payment sheet");
      }
      return { paymentIntentId: paymentIntent.id }; // Return the ID for later use
    } catch (error) {
      console.log("initializePaymentSheet error", error);
      Toast.show({
        type: "error",
        text1: "Payment initialization error",
        text2: error.message || "Please try again later.",
      });
      throw error;
    }
  };

  // Main subscription effect - MODIFIED
  useEffect(() => {
    if (!rideId) return;

    const unsubscribe = subscribeRideRequest(rideId, (rideData) => {
      if (!rideData) return;

      if (rideData.status === 'accepted') {
        unsubscribe();
        setWaitingModalVisible(false);
        Toast.show({
          type: 'success',
          text1: 'Ride Accepted!',
          text2: 'Your driver is on the way.'
        });
        setActiveSheet("pickUpRide");
      } else if (rideData.status === 'rejected' || rideData.status === 'cancelled') {
        // Driver rejected the ride - reset everything
        unsubscribe();
        setWaitingModalVisible(false);
        setRideId(null);
        setPaymentIntentId(null);
        useRideStore.getState().clearActiveRide();
        Toast.show({
          type: 'error',
          text1: rideData.status === 'rejected' ? 'Ride Rejected' : 'Ride Cancelled',
          text2: rideData.status === 'rejected'
            ? 'The driver could not accept your request. Please try again.'
            : 'Your ride has been cancelled.',
        });
        setActiveSheet("confirmRide");
      }
    });

    return () => unsubscribe();
  }, [rideId, setActiveSheet]);

  // Effect for showing the cancel button
  useEffect(() => {
    if (isWaitingModalVisible) {
      const timer = setTimeout(() => {
        setShowCancelButton(true);
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      setShowCancelButton(false);
    }
  }, [isWaitingModalVisible]);

  // Effect to handle the cancellation modal and cleanup
  useEffect(() => {
    let timer;
    if (isCancelConfirmModalVisible) {
      timer = setTimeout(() => {
        finishRideCancellation();
      }, 4000); // 4-second delay
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [isCancelConfirmModalVisible]);


  const finishRideCancellation = () => {
    // 🔔 Notify driver push (non-blocking) before clearing state
    const { activeRide } = useRideStore.getState();
    const effectiveDriverId = driverId || activeRide?.driverId;
    
    console.log("[PaymentButton] finishRideCancellation", { rideId, effectiveDriverId, userId: user?.uid });
    
    if (rideId && effectiveDriverId && user?.uid) {
      notifyDriverCancelPush({
        rideId,
        clientId: user.uid,
        driverId: effectiveDriverId,
        clientName: profileData?.name || "Passenger",
        reason: "Passenger cancelled before driver acceptance",
        canceledAt: new Date().toISOString(),
      });
    }
    updateRideStatus(rideId, 'cancelled');
    useRideStore.getState().clearActiveRide(); // Clear the active ride from the global store
    setWaitingModalVisible(false);
    setRideId(null);
    setPaymentIntentId(null);

    setCancelConfirmModalVisible(false);
    setIsCancelling(false); // Reset cancelling state
    setActiveSheet("confirmRide");
  }

  const handleCancelRide = async () => {
    if (isCancelling || !rideId) return; // Prevent double-clicks
    setIsCancelling(true);

    try {
      if (paymentMethod === 'card' && paymentIntentId) {
        await fetchAPI("/api/stripe/cancelPayment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        });
        setCancelConfirmModalVisible(true);
      } else {
        // For cash rides, just clean up
        finishRideCancellation();
      }
    } catch (err) {
      console.error("Failed to cancel payment", err);
      Toast.show({ type: 'error', text1: 'Cancellation Error', text2: 'Could not cancel the payment. Please contact support.' });
      setIsCancelling(false); // Reset on error
    }
  };


  const handleCashBooking = async () => {
    try {
      const newRideId = await createRideRequest({
        userId: user?.uid,
        driverId: driverId,
        origin: { address: userAddress || '', latitude: userLatitude, longitude: userLongitude },
        destination: { address: destinationAddress || '', latitude: destinationLatitude, longitude: destinationLongitude },
        farePriceCents: Math.round((amount || 0) * 100),
        etaMinutes: Math.max(1, Math.round(rideTime || 5)),
        paymentMethod: 'cash',
        paymentStatus: "requested",
        serviceType: "Ride",
        customerName: profileData?.firstName || profileData?.fullName || user?.displayName || '',
        customerLastName: profileData?.lastName || '',
        customerPhoneNumber: profileData?.phone || '',
        distanceMiles,
      });
      setRideId(newRideId);
      setWaitingModalVisible(true);

      // 🔔 Notify driver via push (non-blocking)
      notifyDriverPush({
        rideId: newRideId,
        clientId: user?.uid,
        driverId: driverId,
        pickup: {
          address: userAddress || '',
          latitude: userLatitude,
          longitude: userLongitude,
        },
        destination: {
          address: destinationAddress || '',
          latitude: destinationLatitude,
          longitude: destinationLongitude,
        },
        estimatedFare: amount || 0,
        estimatedDuration: Math.max(1, Math.round(rideTime || 5)),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to create cash ride request:", err);
      Toast.show({ type: "error", text1: "Booking Error", text2: err.message || "Could not create the ride request." });
    }
  };
      
        const openPaymentSheet = async () => {
          const { paymentIntentId } = await initializePaymentSheet();
          if (!paymentIntentId) return; // Stop if initialization failed
      
          const { error } = await presentPaymentSheet();
      
          if (error) {
            if (error.code !== PaymentSheetError.Canceled) {
              Toast.show({ type: "error", text1: t("payment.error"), text2: error.message });
            }
          } else {
            Toast.show({ type: "success", text1: "Payment Authorized" });
            setPaymentIntentId(paymentIntentId); // Save the intent ID
            try {
              const newRideId = await createRideRequest({
                userId: user?.uid,
                driverId: driverId,
                origin: { address: userAddress, latitude: userLatitude, longitude: userLongitude },
                destination: { address: destinationAddress, latitude: destinationLatitude, longitude: destinationLongitude },
                farePriceCents: Math.round(amount * 100),
                etaMinutes: Math.max(1, Math.round(rideTime || 5)),
                paymentMethod: 'card',
                paymentIntentId: paymentIntentId,
                paymentStatus: "requested",
                serviceType: "Ride",
                customerName: profileData?.fullName || user?.displayName,
                customerLastName: profileData?.lastName || "",
                customerPhoneNumber: profileData?.phone,
                distanceMiles,
              });
              setRideId(newRideId);
              setWaitingModalVisible(true);

              // 🔔 Notify driver via push (non-blocking)
              notifyDriverPush({
                rideId: newRideId,
                clientId: user?.uid,
                driverId: driverId,
                pickup: {
                  address: userAddress || '',
                  latitude: userLatitude,
                  longitude: userLongitude,
                },
                destination: {
                  address: destinationAddress || '',
                  latitude: destinationLatitude,
                  longitude: destinationLongitude,
                },
                estimatedFare: amount || 0,
                estimatedDuration: Math.max(1, Math.round(rideTime || 5)),
                createdAt: new Date().toISOString(),
              });
      } catch (err) {
        console.warn("Failed to create card ride request", err);
        Toast.show({ type: "error", text1: "Booking Error", text2: err.message || "Could not create the ride request." });
      }
    }
  };

  const isCash = paymentMethod === 'cash';

  return (
    <View className="my-10">
      <CustomButton 
        title={isCash ? "Confirm Cash Ride" : "Authorize Payment"}
        onPress={isCash ? handleCashBooking : openPaymentSheet} 
      />

      {/* Waiting for Driver Modal */}
      <ReactNativeModal
        isVisible={isWaitingModalVisible}
        backdropOpacity={0.7}
        animationIn="zoomIn"
        animationOut="zoomOut"
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <ActivityIndicator size="large" color="#2B9DD9" />
          <Text className="text-xl text-center text-black font-bold mt-5">
            Waiting for Confirmation
          </Text>
          <Text className="text-md text-gray-500 text-center mt-3">
            The driver has been notified. We are waiting for them to accept the ride.
          </Text>
          {showCancelButton && (
            <View className="mt-5 w-full">
              <CustomButton
                title={isCancelling ? "Cancelling..." : "Cancel Ride"}
                onPress={handleCancelRide}
                disabled={isCancelling}
                buttonStyle={{ backgroundColor: '#DC2626' }}
              />
            </View>
          )}
        </View>
      </ReactNativeModal>

      {/* Cancellation Confirmation Modal */}
      <ReactNativeModal
        isVisible={isCancelConfirmModalVisible}
      >
        <View className="flex flex-col items-center justify-center bg-white p-7 rounded-2xl">
          <Image
            source={require("../assets/icons/check.png")} // You might want a different icon for cancellation
            className="w-28 h-28 mt-5"
          />
          <Text className="text-2xl text-center text-black font-bold mt-5">
            Ride Cancelled
          </Text>
          <Text className="text-md text-gray-500 text-center mt-3">
            Your ride has been successfully cancelled. No charge was made to your card.
          </Text>
        </View>
      </ReactNativeModal>
    </View>
  );
}
