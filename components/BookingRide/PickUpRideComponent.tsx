import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import AntDesign from '@expo/vector-icons/AntDesign';
import ReactNativeModal from 'react-native-modal';
import Toast from 'react-native-toast-message';
import { useDriverStore, useLocationStore, useRideStore, useRouteStore } from '../../store';
import { onValue, ref, get } from 'firebase/database';
import { subscribeRideRequest, updateRideStatus } from '../../lib/realtime';
import { rtdb } from '../../firebase-config';
import { calculatePickupETA } from '../../lib/Map';
import CustomButton from '../CustomButton';
import { useTranslation } from '../../hooks/useTranslation';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase-config';
import { useAuth } from '../../lib/context/AuthContext';
import { useProfile } from '../../lib/context/ProfileContext';

import { useRouter } from 'expo-router';

export default function PickUpRideComponent(props: any) {
    const { setActiveSheet } = props;
    const router = useRouter();
    const { drivers, selectedDriver, realtimeDriver, setRealtimeDriver } = useDriverStore();
    const { activeRide, clearActiveRide } = useRideStore();
    const { userLatitude, userLongitude } = useLocationStore();
    const { user } = useAuth();
    const { profileData } = useProfile();
    const { t } = useTranslation("ride");
    const { t: tHome } = useTranslation("home");

    const [rideDetails, setRideDetails] = useState(activeRide);
    const [isCancelModalVisible, setCancelModalVisible] = useState(false);
    const [pickupEta, setPickupEta] = useState<number | null>(null);

    const activeDriver = realtimeDriver || (drivers || []).find(d => d.id === rideDetails?.driverId || d.id === selectedDriver?.id);

    useEffect(() => {
        const getEta = async () => {
            if (activeDriver && userLatitude && userLongitude) {
                const eta = await calculatePickupETA({
                    driverLocation: { latitude: activeDriver.lat, longitude: activeDriver.lng },
                    userLocation: { latitude: userLatitude, longitude: userLongitude },
                });
                setPickupEta(eta);
            }
        };

        // Recalculate ETA every time the driver's location updates (via RTDB listener)
        getEta();
    }, [activeDriver, userLatitude, userLongitude]);
 
    

    useEffect(() => {
        const driverId = activeRide?.driverId;
        if (!driverId) return;

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

            if (rideData.status === 'in_progress') {
                unsubscribe();
                setActiveSheet("riding");
            } else if (rideData.status === 'completed') {
                unsubscribe();
                router.replace({
                    pathname: "/ride-completed",
                    params: { rideId: rideData.id, driverId: rideData.driverId, paymentMethod: rideData.paymentMethod }
                });
            } else if (rideData.status === 'cancelled') {
                unsubscribe();
                clearActiveRide();
                router.replace("/(tabs)/home");
            }
        });

        return () => unsubscribe();

    }, [activeRide?.id, router, clearActiveRide]);

    const handleCancelRide = () => {
        setCancelModalVisible(true);
    };

    const handleContactDriver = () => {
        const phoneNumber = activeDriver?.phone || activeDriver?.phoneNumber;
        if (phoneNumber) {
            Linking.openURL(`tel:${phoneNumber}`);
        } else {
            Toast.show({ type: "error", text1: t("pickup.error"), text2: t("pickup.driverPhoneNotAvailable")});
        }
    };

    const confirmCancelRide = () => {
        if (activeRide?.id && rideDetails?.status !== 'completed' && rideDetails?.status !== 'cancelled') {
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
                        reason: "Passenger cancelled during pickup",
                        canceledAt: new Date().toISOString()
                    }).catch(() => {});
                } catch (_) {}
            }
            updateRideStatus(activeRide.id, 'cancelled');
        }
        setCancelModalVisible(false);
    };


    if (!rideDetails || !realtimeDriver) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <ActivityIndicator size="large" color="#2B9DD9" />
                <Text className="mt-4 text-lg">{t("pickup.loadingDetails")}</Text>
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
                        <Text className="text-lg font-bold">{activeDriver?.driverName || t("pickup.driver")}</Text>
                        <Text className="text-gray-600">{activeDriver?.car_model || t("pickup.carModel")}</Text>
                        <View className="flex-row items-center mt-1">
                            <AntDesign name="star" size={16} color="#FFD700" />
                            <Text className="ml-1 font-bold">{activeDriver?.rating || '4.9'}</Text>
                        </View>
                    </View>
                </View>

                <View className="my-5">
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-gray-500">{t("pickup.price")}</Text>
                        <Text className="font-bold text-secondary capitalize">${(rideDetails?.farePriceCents / 100).toFixed(2)}</Text>
                    </View>
                    <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-gray-500">{t("pickup.arrivesIn")}</Text>
                        <Text className="font-bold text-base">{pickupEta !== null ? `${pickupEta} min` : '...'}</Text>
                    </View>
                    <View className="mb-4">
                        <Text className="text-gray-500 mb-1">{t("pickup.pickupAt")}</Text>
                        <Text className="font-semibold" numberOfLines={1}>{rideDetails?.origin?.address || tHome("currentLocationShort")}</Text>
                    </View>
                    <View className='mb-4'>
                        <Text className="text-gray-500 mb-1">{t("pickup.destination")}</Text>
                        <Text className="font-semibold" numberOfLines={1}>{rideDetails?.destination?.address || t("pickup.destination")}</Text>
                    </View>
                </View>

                <View className="flex-1 justify-end items-center pb-2 space-y-3">
                    <View className="w-2/3">
                        <CustomButton
                            title={t("pickup.contactDriver")}
                            onPress={handleContactDriver}
                            disabled={!(activeDriver?.phone || activeDriver?.phoneNumber)}
                        />
                    </View>
                    <TouchableOpacity 
                        onPress={handleCancelRide}
                        disabled={rideDetails?.status === 'completed' || rideDetails?.status === 'cancelled'}
                    >
                        <Text className="text-red-500  text-base">{t("pickup.cancelRide")}</Text>
                    </TouchableOpacity>
                </View>

                <ReactNativeModal
                    isVisible={isCancelModalVisible}
                    onBackdropPress={() => setCancelModalVisible(false)}
                >
                    <View className="bg-white p-6 rounded-lg">
                        <Text className="text-lg font-bold text-center">{t("pickup.cancelRide")}</Text>
                        <Text className="text-center my-4">{t("pickup.cancelConfirm")}</Text>
                        <View className="flex-row justify-around mt-4">
                            <TouchableOpacity onPress={() => setCancelModalVisible(false)} className="py-2 px-8 bg-gray-200 rounded-full">
                                <Text className="font-bold">{t("pickup.no")}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={confirmCancelRide} className="py-2 px-8 bg-red-500 rounded-full">
                                <Text className="text-white font-bold">{t("pickup.yesCancel")}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ReactNativeModal>
            </View>
        </View>
    )
}