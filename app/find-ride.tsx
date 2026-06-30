import React, { useCallback, useState, useMemo, useRef, useEffect } from "react";
import { View, Text, Image, ActivityIndicator, TouchableOpacity, Dimensions } from "react-native";
import { useDriverStore, useLocationStore, useRideStore, useRouteStore, usePaymentStore } from "../store";
import { Ionicons } from "@expo/vector-icons";
import Map from "../components/Map";
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from "@gorhom/bottom-sheet";
import FindRideComponent from "../components/BookingRide/FindRideComponent";
import PaymentMethodComponent from "../components/BookingRide/PaymentMethodComponent";
import ConfirmRideComponent from "../components/BookingRide/ConfirmRideComponent";
import PickUpRideComponent from "../components/BookingRide/PickUpRideComponent";
import BookRideComponent from "../components/BookingRide/BookRideComponent";
import RidingComponent from "../components/BookingRide/RidingComponent";
import CurrentLocationMap from "../components/CurrentLocationMap";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../lib/context/AuthContext";
import { useTranslation } from "../hooks/useTranslation";
import { rtdb } from "../firebase-config";
import { ref, query, orderByChild, equalTo, onValue, off } from "firebase/database";
import { cleanupRideRequestsOnly } from "../lib/cleanupFunctions";
import { useRouter } from "expo-router";

export default function FindRide() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { realtimeDriver } = useDriverStore();

  const getInitialSheet = (ride: any) => {
    if (!ride) return "findRide";
    switch (ride.status) {
      case "requested": return "bookRide";
      case "accepted":
      case "driver_arrived": return "pickUpRide";
      case "in_progress":
      case "arrived": return "riding";
      default: return "findRide";
    }
  };

  const [activeSheet, setActiveSheet] = useState<string>(() => getInitialSheet(useRideStore.getState().activeRide));
  const [isRiding, setIsRiding] = useState<boolean>(() => {
    const ride = useRideStore.getState().activeRide;
    return !!(ride && ["in_progress", "arrived"].includes(ride.status));
  });

  const { userLatitude, userLongitude, loading } = useLocationStore();
  const { user } = useAuth();
  const bottomSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    return () => {
      useLocationStore.getState().clearDestinationLocation();
      useDriverStore.getState().clearSelectedDriver();
      useRouteStore.getState().clearRouteInfo();
      usePaymentStore.getState().setPaymentMethod(null);
      useRideStore.getState().clearActiveRide();
    };
  }, []);

  const snapPoints = useMemo(() => {
    const windowHeight = Dimensions.get("window").height;
    
    switch (activeSheet) {
      case "findRide":
        // FindRideComponent contains 2 inputs and a main button (approx 320px including margins/safe areas)
        return [Math.min(320, windowHeight * 0.9), "90%"];
      case "paymentOptions":
        // PaymentMethodComponent contains 2 rows and a button (approx 330px)
        return [Math.min(330, windowHeight * 0.9), "90%"];
      case "confirmRide":
        // ConfirmRideComponent shows driver cards (approx 480px fits 2 cards plus headers)
        return [Math.min(480, windowHeight * 0.9), "90%"];
      case "bookRide":
        // BookRideComponent is very tall with specs and address preview (approx 580px)
        return [Math.min(580, windowHeight * 0.9), "90%"];
      case "pickUpRide":
        // PickUpRideComponent shows active driver and ETA/locations (approx 420px)
        return [Math.min(420, windowHeight * 0.9), "90%"];
      case "riding":
        // RidingComponent shows ride status and 3 action buttons (approx 470px)
        return [Math.min(470, windowHeight * 0.9), "90%"];
      default:
        return [Math.min(400, windowHeight * 0.9), "90%"];
    }
  }, [activeSheet]);

  useEffect(() => {
    bottomSheetRef.current?.snapToIndex(0);
  }, [activeSheet]);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;

      const rideRequestsRef = ref(rtdb, "rideRequests");
      const ridesQuery = query(
        rideRequestsRef,
        orderByChild("userId"),
        equalTo(user.uid)
      );

      const handleSnapshot = (snapshot: any) => {
        try {
          if (snapshot.exists()) {
            const rides = snapshot.val();
            let activeRideFound = false;
            let wasRejected = false;
            for (const rideId in rides) {
              const ride = rides[rideId];
              if (["requested", "accepted", "driver_arrived", "in_progress", "arrived"].includes(ride.status)) {
                const { setActiveRide } = useRideStore.getState();
                const { setDestinationLocation } = useLocationStore.getState();
                const { setSelectedDriver } = useDriverStore.getState();
                const { setPaymentMethod } = usePaymentStore.getState();

                setActiveRide({ id: rideId, ...ride });
                setDestinationLocation(ride.destination);
                setSelectedDriver(ride.driverId);
                setPaymentMethod(ride.paymentMethod);

                switch (ride.status) {
                  case "requested":
                    setIsRiding(false);
                    setActiveSheet("bookRide");
                    break;
                  case "accepted":
                  case "driver_arrived":
                    setIsRiding(false);
                    setActiveSheet("pickUpRide");
                    break;
                  case "in_progress":
                  case "arrived":
                    setIsRiding(true);
                    setActiveSheet("riding");
                    break;
                  default:
                    setIsRiding(false);
                    setActiveSheet("findRide");
                }

                activeRideFound = true;
                break;
              } else if (["rejected", "cancelled", "completed"].includes(ride.status)) {
                if (ride.status === "rejected") {
                  wasRejected = true;
                }
                useRideStore.getState().clearActiveRide();
                cleanupRideRequestsOnly().catch(err => console.log("Background cleanup error:", err));
              }
            }
            if (!activeRideFound) {
              useRideStore.getState().clearActiveRide();
              setIsRiding(false);
              if (wasRejected) {
                setActiveSheet("confirmRide");
                useDriverStore.getState().clearSelectedDriver();
              } else if (activeSheet === "confirmRide" || activeSheet === "paymentOptions") {
                // Conservar pantalla de configuracion de reserva
              } else {
                setActiveSheet("findRide");
              }
            }
          } else {
            useRideStore.getState().clearActiveRide();
            setIsRiding(false);
            if (activeSheet === "confirmRide" || activeSheet === "paymentOptions") {
              // Conservar pantalla de configuracion de reserva
            } else {
              setActiveSheet("findRide");
            }
          }
        } catch (e) {
          console.log("Error procesando snapshot de rides:", e);
          setIsRiding(false);
          setActiveSheet("findRide");
        }
      };

      onValue(ridesQuery, handleSnapshot, (error) => {
        console.log("RTDB onValue error:", error);
      });

      return () => {
        off(ridesQuery, "value", handleSnapshot);
      }; 
    }, [user])
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#2B9DD9" />
        <Text className="mt-4 text-lg">Getting your location...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="flex flex-col h-screen bg-blue-500">
        <View className="flex flex-row absolute bg-secondary w-full z-10 pt-12 items-center justify-between px-5">
          <View className="flex flex-row items-center">
            <TouchableOpacity onPress={() => router.back()}>
               <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                 <Ionicons name="arrow-back-outline" size={24} color="black" />
               </View>
            </TouchableOpacity>
            <Text className="text-xl font-bold text-white ml-5">{t("navigation.goBack")}</Text>
          </View>
          <View className="h-20 w-20 "> 
            <Image
              source={{
                uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/IMG-Auth-logo-white.png?alt=media&token=b7a62226-856a-4ef0-9924-758576334bf5`,
              }}
              className="h-full w-full"
            />
          </View>
        </View>
         
        {userLatitude && userLongitude ? <Map driver={realtimeDriver} isRiding={isRiding} /> : <CurrentLocationMap />}
      </View>
      <BottomSheet
        keyboardBehavior="extend"
        ref={bottomSheetRef}
        snapPoints={snapPoints}
        index={0}
      >
        {activeSheet === 'findRide' && (
          <BottomSheetView className="px-4 py-3" style={{ flex: 1 }}>
            <FindRideComponent setActiveSheet={setActiveSheet} />
          </BottomSheetView>
        )}

        {activeSheet !== 'findRide' && (
          <BottomSheetScrollView
            className="px-4 py-3"
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
          >
            {activeSheet === 'paymentOptions' && <PaymentMethodComponent setActiveSheet={setActiveSheet} />}
            {activeSheet === 'confirmRide' && <ConfirmRideComponent setActiveSheet={setActiveSheet} />}
            {activeSheet === 'bookRide' && <BookRideComponent setActiveSheet={setActiveSheet} navigation={router as any} />}
            {activeSheet === 'pickUpRide' && <PickUpRideComponent setActiveSheet={setActiveSheet} navigation={router as any} />}
            {activeSheet === 'riding' && <RidingComponent setIsRiding={setIsRiding} navigation={router as any} />}
          </BottomSheetScrollView>
        )}
      </BottomSheet>
    </View>
  );
}
