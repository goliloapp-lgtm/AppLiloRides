import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, Image, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import ReactNativeModal from 'react-native-modal';
import Toast from 'react-native-toast-message';
import { useDriverStore, useRideStore, useLocationStore } from '../../store';
import CustomButton from '../CustomButton';
import { ref, onValue, get } from 'firebase/database';
import { rtdb } from '../../firebase-config';
import { subscribeRideRequest, updateRideStatus } from '../../lib/realtime';
import { useStripe } from '@stripe/stripe-react-native';
import { fetchAPI } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase-config';
import { useAuth } from '../../lib/context/AuthContext';
import { useProfile } from '../../lib/context/ProfileContext';
import { getSupportContactNumber } from '../../lib/support';

import { useRouter } from 'expo-router';

export default function RidingComponent(props: any) {
    const { setIsRiding } = props;
    const router = useRouter();
    const { drivers, selectedDriver, setDrivers, clearSelectedDriver, realtimeDriver, setRealtimeDriver } = useDriverStore();
    const { activeRide, clearActiveRide } = useRideStore();
    const { userLatitude, userLongitude, userAddress, setUserLocation, setDestinationLocation } = useLocationStore();
    const { resetPaymentSheetCustomer } = useStripe();
    const { user } = useAuth();
    const { profileData } = useProfile();
    const { t } = useTranslation("ride");
    const { t: tHome } = useTranslation("home");

    const cleanupPaymentSheet = async () => {
        try {
            await resetPaymentSheetCustomer();
        } catch (e) {
            console.warn('Stripe resetPaymentSheetCustomer error:', e);
        }
    };

    const [rideDetails, setRideDetails] = useState(activeRide);
    const [isCancelModalVisible, setCancelModalVisible] = useState(false);

    // Find the active driver from the initial drivers list or the realtime update
    const activeDriver = realtimeDriver || (drivers || []).find(d => d.id === rideDetails?.driverId || d.id === selectedDriver?.id);

    
        useLayoutEffect(() => {
        setIsRiding(true);
        return () => {
            setIsRiding(false);
        };
    }, []);

    useEffect(() => {
        const driverId = activeRide?.driverId;
        if (!driverId) {
            return;
        };

        const driverRef = ref(rtdb, `conductores_activos/${driverId}`);

        const updateDriverData = (snapshot: any) => {
            const currentDriverData = useDriverStore.getState().realtimeDriver;
            if (snapshot.exists()) {
                const newDriverData = { id: snapshot.key, ...snapshot.val() };
                if (JSON.stringify(newDriverData) !== JSON.stringify(currentDriverData)) {
                    setRealtimeDriver(newDriverData);
                }
            } else {
                if (currentDriverData !== null) {
                    setRealtimeDriver(null);
                }
            }
        };

        // Real-time listener
        const unsubscribe = onValue(driverRef, updateDriverData);

        // Polling interval as requested
        const interval = setInterval(() => {
            get(driverRef).then(updateDriverData);
        }, 15000);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, [activeRide?.driverId]);

    useEffect(() => {
        const rideId = activeRide?.id;
        if (!rideId) {
            router.replace("/(tabs)/home");
            return;
        }

        const unsubscribe = subscribeRideRequest(rideId, (rideData) => {
            if (!rideData) {
                router.replace("/(tabs)/home");
                return;
            }

            setRideDetails(rideData);

            if (rideData.status === 'completed') {
                cleanupPaymentSheet();
                // The useEffect cleanup function will handle the unsubscribe.

                // Capture the main ride payment before proceeding
                if (rideData.paymentMethod === 'card' && rideData.paymentIntentId) {
                    fetchAPI('/api/stripe/capturePayment', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentIntentId: rideData.paymentIntentId }),
                    }).catch(err => {
                        console.error("Failed to capture payment:", err);
                        // Even if capture fails, proceed to completion screen to not block the user
                    });
                }

                router.replace({
                    pathname: "/ride-completed",
                    params: {
                        rideId: rideData.id,
                        driverId: rideData.driverId,
                        paymentMethod: rideData.paymentMethod,
                        fare: rideData.farePriceCents / 100, // Pass fare in dollars
                    }
                });
            } else if (rideData.status === 'cancelled') {
                cleanupPaymentSheet();
                clearActiveRide();
                clearSelectedDriver();
                setDrivers([]);
                setUserLocation({ latitude: null, longitude: null, address: null });
                setDestinationLocation({ latitude: null, longitude: null, address: null });

                setTimeout(() => {
                    router.replace("/(tabs)/home");
                }, 1500);
            }
        });

        return () => unsubscribe();

    }, [activeRide?.id, clearActiveRide, router, clearSelectedDriver, setDrivers, setUserLocation, setDestinationLocation]);

    const handleContactSupport = async () => {
        try {
            const supportNumber = await getSupportContactNumber();
            Linking.openURL(`tel:${supportNumber}`);
        } catch (error) {
            console.error("Error opening support contact:", error);
            Linking.openURL('tel:+16787378687');
        }
    };

    const handleEmergencyCall = () => {
        Linking.openURL('tel:911');
    };

    const shareRideViaSMS = () => {
        if (!userLatitude || !userLongitude) {
            Toast.show({ type: "error", text1: t("riding.locationNotAvailable"), text2: t("riding.cannotShare") });
            return;
        }

        const mapsLink = `https://www.google.com/maps/search/?api=1&query=${userLatitude},${userLongitude}`;
        const message = `I'm currently at ${userAddress || 'an unknown location'}. You can see my live location here: ${mapsLink}`;
        
        Linking.openURL(`sms:?body=${encodeURIComponent(message)}`);
    };

    const handleCancelRide = () => {
        setCancelModalVisible(true);
    };

    const confirmCancelRide = () => {
        if (activeRide?.id && rideDetails?.status !== 'completed' && rideDetails?.status !== 'cancelled') {
            cleanupPaymentSheet();
            // 🔔 Notify driver push (non-blocking)
            const driverId = activeRide?.driverId;
            if (driverId && user?.uid) {
                try {
                    const fn = httpsCallable(functions, 'notifyDriverRideCancelled');
                    fn({ 
                        rideId: activeRide.id, 
                        clientId: user.uid, 
                        driverId,
                        clientName: profileData?.name || "Passenger",
                        reason: "Passenger cancelled mid-trip",
                        canceledAt: new Date().toISOString()
                    }).catch(() => {});
                } catch (_) {}
            }
            updateRideStatus(activeRide.id, 'cancelled');
            
            clearActiveRide();
            clearSelectedDriver();
            setDrivers([]);
            setUserLocation({ latitude: null, longitude: null, address: null });
            setDestinationLocation({ latitude: null, longitude: null, address: null });
            
            router.replace("/(tabs)/home");
        }
        setCancelModalVisible(false);
    };


if (!rideDetails || !realtimeDriver) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#2B9DD9" />
                <Text className="mt-4 text-lg">{t("riding.loadingDetails")}</Text>
            </View>
        );
    }

  return (
    <View className='pb-4'>

    <View className="flex-1 p-4">
                    <View className="flex-row items-center pb-4 border-b border-gray-200">
                        <Image 
                            source={{ uri: activeDriver?.profilePhoto || 'https://via.placeholder.com/150' }}
                            className="w-20 h-20 rounded-full"
                        />
                        <View className="ml-4 flex-1">
                            <Text className="text-lg font-bold">{activeDriver?.driverName || t("riding.driver")}</Text>
                            <Text className="text-gray-600">{activeDriver?.car_model || t("riding.carModel")}</Text>
                            <View className="flex-row items-center mt-1">
                                <AntDesign name="star" size={16} color="#FFD700" />
                                <Text className="ml-1 font-bold">{activeDriver?.rating || '4.9'}</Text>
                            </View>
                        </View>
                    </View>

                    <View className="my-5">
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-500">{t("riding.price")}</Text>
                            <Text className="font-bold text-secondary capitalize">${(rideDetails?.farePriceCents / 100).toFixed(2)}</Text>
                        </View>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-500">{t("riding.eta")}</Text>
                            <Text className="font-bold text-base">{rideDetails?.etaMinutes || '...'} min</Text>
                        </View>
                        <View className="mb-4">
                            <Text className="text-gray-500 mb-1">{t("riding.from")}</Text>
                            <Text className="font-semibold" numberOfLines={1}>{rideDetails?.origin?.address || tHome("currentLocationShort")}</Text>
                        </View>
                        <View className='mb-4'>
                            <Text className="text-gray-500 mb-1">{t("riding.to")}</Text>
                            <Text className="font-semibold" numberOfLines={1}>{rideDetails?.destination?.address || t("riding.destination")}</Text>
                        </View>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-gray-500 mb-1">{t("riding.seats")}</Text>
                            <Text className="font-semibold" numberOfLines={1}>{activeDriver?.seatsAvailable}</Text>
                        </View>
                    </View>

                    <View className="flex-row flex-wrap gap-5 justify-center items-center ">
                        <View className="">
                            <CustomButton
                                title={t("riding.contactSupport")}
                                onPress={handleContactSupport}
                            />
                        </View>
                        <View className="">
                            <CustomButton
                                title={t("riding.shareRide")}
                                onPress={shareRideViaSMS}
                            />
                        </View>
                        <View className=""> 
                            <CustomButton
                                title={t("riding.emergency")}
                                onPress={handleEmergencyCall}
                                isCancel={true} // This will make the button red
                            />
                        </View>
                    </View>

                    <ReactNativeModal
                        isVisible={isCancelModalVisible}
                        onBackdropPress={() => setCancelModalVisible(false)}
                    >
                        <View className="bg-white p-6 rounded-lg">
                            <Text className="text-lg font-bold text-center">{t("riding.cancelRide")}</Text>
                            <Text className="text-center my-4">{t("riding.cancelConfirm")}</Text>
                            <View className="flex-row justify-around mt-4">
                                <TouchableOpacity onPress={() => setCancelModalVisible(false)} className="py-2 px-8 bg-gray-200 rounded-full">
                                    <Text className="font-bold">{t("riding.no")}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={confirmCancelRide} >
                                    <Text className="text-red-500 font-bold">{t("riding.yesCancel")}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ReactNativeModal>
                </View>
    </View>
  )
}