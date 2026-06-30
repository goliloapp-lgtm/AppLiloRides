import "../global.css";
import { verifyInstallation } from "nativewind";
import { useCallback, useEffect, useState } from "react";
import { View, Text, Alert, Platform, StyleSheet } from "react-native";
import { Slot, Stack, useRouter } from "expo-router";
import { AuthProvider, useAuth } from "../lib/context/AuthContext";
import { ProfileProvider, useProfile } from "../lib/context/ProfileContext";
import { LanguageProvider } from "../lib/context/LanguageContext";
import { ActivityIndicator } from "react-native-paper";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import "react-native-get-random-values";
import Auth from "../components/auth/Auth";
import Toast from "react-native-toast-message";
import DisabledUser from "../components/auth/DisabledUser";
import CompleteProfile from "../components/auth/CompleteProfile";
import { StripeProvider } from "@stripe/stripe-react-native";
import { rtdb } from "../firebase-config";
import { ref, query, orderByChild, equalTo, get } from "firebase/database";
import { useLocationStore, useRideStore, useDriverStore, usePaymentStore } from "../store";
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logoutUser } from '../lib/auth';
import { initializeFCM, getInitialNotification, handleNotification } from '../lib/fcm';
import messaging from '@react-native-firebase/messaging';
import i18n from '../i18n/config';

// ─── Background / Killed-State Handler ────────────────────────────────────────
// This MUST live at the module level (outside any component).
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('[FCM] Background message received:', remoteMessage.data);

  const LANGUAGE_STORAGE_KEY = '@user_language';
  let lang = 'en';
  try {
    const stored = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored === 'es' || stored === 'en') lang = (stored as 'en' | 'es');
  } catch (_) {}

  const strings = {
    en: {
      RIDE_ACCEPTED:              { title: 'Driver accepted your ride!',         body: 'Your driver is on the way.' },
      RIDE_REJECTED:              { title: 'Ride rejected',                       body: 'The driver is not available. Find another driver.' },
      RIDE_STARTED:               { title: 'Your ride has started!',              body: 'Enjoy the trip.' },
      RIDE_CANCELLED_BY_DRIVER:   { title: 'Ride cancelled by driver',            body: 'Your driver cancelled the trip. Please request a new one.' },
      RIDE_CANCELLED_BY_CLIENT:   { title: 'Ride cancelled',                      body: 'Your ride has been cancelled.' },
      DRIVER_ARRIVED:             { title: 'Your driver has arrived!',            body: 'Your driver is waiting at the pickup point.' },
      SESSION_TERMINATED:         { title: 'Session closed',                      body: 'Your session was closed from another device.' },
      _default:                   { title: 'Lilo',                                body: 'You have a ride update.' },
    },
    es: {
      RIDE_ACCEPTED:              { title: '¡Conductor aceptó tu viaje!',         body: 'Tu conductor está en camino.' },
      RIDE_REJECTED:              { title: 'Carrera rechazada',                   body: 'El conductor no está disponible. Busca otro conductor.' },
      RIDE_STARTED:               { title: '¡Tu viaje ha comenzado!',             body: 'Disfruta el trayecto.' },
      RIDE_CANCELLED_BY_DRIVER:   { title: 'Viaje cancelado por el conductor',   body: 'Tu conductor canceló el viaje. Por favor solicita uno nuevo.' },
      RIDE_CANCELLED_BY_CLIENT:   { title: 'Viaje cancelado',                    body: 'Tu viaje ha sido cancelado.' },
      DRIVER_ARRIVED:             { title: '¡Tu conductor ha llegado!',          body: 'Tu conductor te espera en el punto de recogida.' },
      SESSION_TERMINATED:         { title: 'Sesión cerrada',                      body: 'Tu sesión fue cerrada desde otro dispositivo.' },
      _default:                   { title: 'Lilo',                                body: 'Tienes una actualización en tu viaje.' },
    },
  };

  const data = remoteMessage.data ?? {};
  const type = data.type as string | undefined;
  const langKey = lang as 'en' | 'es';
  const { title, body } = (strings[langKey] as any)[type ?? '_default'] ?? strings[langKey]._default;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
        ...(Platform.OS === 'android' && { channelId: 'ride-events' }),
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('[FCM] Failed to schedule local notification:', e);
  }
});

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  verifyInstallation();
  const [fontsLoaded, fontError] = useFonts({
    CenturyGothic: require("../assets/fonts/CenturyGothic.ttf"),
  });

  console.log("[RootLayout] fontsLoaded:", fontsLoaded, "fontError:", fontError);

  useEffect(() => {
    if (fontsLoaded) {
      console.log("[RootLayout] Hiding splash screen...");
      SplashScreen.hideAsync().catch((err) => console.warn("[RootLayout] hideAsync error:", err));
    } else if (fontError) {
      console.error("[RootLayout] Font loading failed:", fontError);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}>
        <LanguageProvider>
          <AuthProvider>
            <ProfileProvider>
              <AppContent />
            </ProfileProvider>
          </AuthProvider>
        </LanguageProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { profileData, loading: profileLoading } = useProfile();
  const router = useRouter();

  useEffect(() => {
    let cleanupFn: () => void = () => {};

    if (user) {
      const setupFCM = async () => {
        const cleanup = await initializeFCM({
          onSessionTerminated: async () => {
            console.log('[App] SESSION_TERMINATED – logging out...');
            await logoutUser();
          },
          onRideAccepted: () => {
            console.log('[App] RIDE_ACCEPTED push received');
            Toast.show({
              type: 'success',
              text1: i18n.t('common:notifications.rideAccepted.title'),
              text2: i18n.t('common:notifications.rideAccepted.body'),
            });
          },
          onDriverArrived: () => {
            console.log('[App] DRIVER_ARRIVED push received');
            Toast.show({
              type: 'success',
              text1: i18n.t('common:notifications.driverArrived.title'),
              text2: i18n.t('common:notifications.driverArrived.body'),
            });
          },
          onRideRejected: () => {
            console.log('[App] RIDE_REJECTED push received');
            Toast.show({
              type: 'error',
              text1: i18n.t('common:notifications.rideRejected.title'),
              text2: i18n.t('common:notifications.rideRejected.body'),
            });
          },
          onRideStarted: () => {
            console.log('[App] RIDE_STARTED push received');
            Toast.show({
              type: 'info',
              text1: i18n.t('common:notifications.rideStarted.title'),
              text2: i18n.t('common:notifications.rideStarted.body'),
            });
          },
          onRideCancelledByDriver: () => {
            console.log('[App] RIDE_CANCELLED_BY_DRIVER push received');
            Toast.show({
              type: 'error',
              text1: i18n.t('common:notifications.rideCancelledByDriver.title'),
              text2: i18n.t('common:notifications.rideCancelledByDriver.body'),
            });
          },
        });

        if (cleanup) cleanupFn = cleanup;
      };

      setupFCM();
    }

    return () => {
      cleanupFn();
    };
  }, [user]);

  // --- NOTIFICATION LISTENERS ---
  useEffect(() => {
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data ?? {};
      console.log('📬 Expo foreground notification:', data);
    });

    const backgroundSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data ?? {};
      console.log('📬 Notification tapped:', data);

      handleNotification(data, {
        onSessionTerminated: () => logoutUser(),
        onRideAccepted: () => {
          router.navigate('/find-ride');
        },
        onRideRejected: () => {
          router.navigate('/(tabs)/home'); // book-ride is home inside tabs or modal? Let's check routes
        },
        onRideStarted: () => {
          router.navigate('/find-ride');
        },
        onDriverArrived: () => {
          router.navigate('/find-ride');
        },
        onRideCancelledByDriver: () => {
          router.navigate('/(tabs)/home');
        },
      });
    });

    getInitialNotification().then((data) => {
      if (!data) return;
      console.log('[App] App opened from notification:', data);
      setTimeout(() => {
        handleNotification(data, {
          onSessionTerminated: () => logoutUser(),
          onRideAccepted: () => {
            router.navigate('/find-ride');
          },
          onRideRejected: () => {
            router.navigate('/(tabs)/home');
          },
          onRideStarted: () => {
            router.navigate('/find-ride');
          },
          onDriverArrived: () => {
            router.navigate('/find-ride');
          },
          onRideCancelledByDriver: () => {
            router.navigate('/(tabs)/home');
          },
        });
      }, 1500);
    });

    return () => {
      foregroundSubscription.remove();
      backgroundSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const checkForActiveRide = async () => {
      // querySucceeded tracks whether Firebase responded correctly.
      // clearActiveRide() must ONLY be called when the query succeeded and
      // genuinely found no active ride — never when the query itself failed.
      let querySucceeded = false;
      try {
        const rideRequestsRef = ref(rtdb, "rideRequests");
        const ridesQuery = query(
          rideRequestsRef,
          orderByChild("userId"),
          equalTo(user.uid)
        );

        const snapshot = await get(ridesQuery);
        querySucceeded = true; // Query reached Firebase and returned a valid response

        let foundActiveRide = false;
        if (snapshot.exists()) {
          const rides = snapshot.val();
          for (const rideId in rides) {
            const ride = rides[rideId];
            if (
              ["requested", "accepted", "driver_arrived", "in_progress", "arrived"].includes(ride.status)
            ) {
              const { setActiveRide } = useRideStore.getState();
              const { setDestinationLocation } = useLocationStore.getState();
              const { setSelectedDriver } = useDriverStore.getState();
              const { setPaymentMethod } = usePaymentStore.getState();

              setActiveRide({ id: rideId, ...ride });
              setDestinationLocation(ride.destination);
              setSelectedDriver(ride.driverId);
              setPaymentMethod(ride.paymentMethod);
              foundActiveRide = true;
              break;
            }
          }
        }

        // Only clear when the query confirmed there is truly no active ride
        if (!foundActiveRide) {
          useRideStore.getState().clearActiveRide();
        }
      } catch (error) {
        // Query failed (e.g. missing RTDB index, network error, permission denied).
        // Do NOT touch the active ride state — we don't know the truth.
        // The existing state is preserved until the next successful query.
        console.error("Error checking for active ride:", error);
        if (!querySucceeded) {
          console.warn("Active ride state preserved due to query failure. Will retry on next auth change.");
        }
      }
    };

    checkForActiveRide();
  }, [isAuthenticated, user]);

  const { activeRide } = useRideStore();

  useEffect(() => {
    if (activeRide) {
      const screen = getScreenFromStatus(activeRide.status);
      router.navigate(screen);
    }
  }, [activeRide]);

  const getScreenFromStatus = (status: string) => {
    switch (status) {
      case "requested":
      case "accepted":
      case "in_progress":
      case "arrived":
        return "/find-ride";
      default:
        return "/(tabs)/home";
    }
  };

  const isActive = profileData?.isActive;

  if (authLoading || profileLoading) {
    return (
      <View className="bg-gray-100 min-h-screen flex justify-center items-center">
        <ActivityIndicator animating={true} color="#2B9DD9" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Auth />;
  }

  if (isActive === false) {
    return <DisabledUser />;
  }

  const isProfileIncomplete = isAuthenticated && user && (!profileData?.phone?.trim() || !profileData?.displayName?.trim());

  if (isProfileIncomplete) {
    return <CompleteProfile />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
      <Toast
        position="top"
        {...({ style: { zIndex: 9999, elevation: 9999 } } as any)}
        pointerEvents="box-none"
      />
    </View>
  );
}
