import { View, Text, ActivityIndicator, FlatList } from 'react-native'
import React, { useEffect, useState, useRef } from 'react'
import { useDriverStore, useLocationStore, usePaymentStore } from '../../store';
import { rtdb } from '../../firebase-config';
import { get, ref } from 'firebase/database';
import DriverCard from '../DriverCard';
import { calculateDriverTimes } from '../../lib/Map';
import { useTranslation } from '../../hooks/useTranslation';

export default function ConfirmRideComponent(props) {
 const { setActiveSheet } = props;
    const { drivers, selectedDriver, setSelectedDriver, setDrivers, driversFetchTrigger } =
      useDriverStore();
    const { paymentMethod } = usePaymentStore();
    const { userLatitude, userLongitude, destinationLatitude, destinationLongitude } = useLocationStore();
    const [loading, setLoading] = useState(true);
    const { t } = useTranslation("ride");
  
    const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
      const R = 6371; // Radius of the earth in km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
          Math.cos(lat2 * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c; // Distance in km
      return distance * 0.621371; // Convert to miles
    };
  
   
   // Guard ref: ensures we only fetch+calculate once per trigger cycle
  const hasFetched = useRef(false);

  // When Map.tsx detects a new driver came online, driversFetchTrigger increments.
  // Reset hasFetched so the fetch effect below will re-run for the new driver.
  useEffect(() => {
    if (driversFetchTrigger === 0) return; // skip initial mount (handled by the fetch effect)
    hasFetched.current = false;
    setLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driversFetchTrigger]);

  useEffect(() => {
    // Only run once per trigger cycle and when coordinates are available
    if (hasFetched.current) return;
    if (!userLatitude || !userLongitude || !destinationLatitude || !destinationLongitude) return;

    hasFetched.current = true;

    const driversRef = ref(rtdb, "conductores_activos");

    // Use get() (one-time read) instead of onValue (realtime listener)
    // to avoid calling calculateDriverTimes on EVERY driver GPS update.
    get(driversRef)
      .then(async (snapshot) => {
        if (!snapshot.exists()) {
          setDrivers([]);
          setLoading(false);
          return;
        }

        const driversData = snapshot.val();
        const driversList = Object.keys(driversData)
          .map((key) => ({
            id: key,
            ...driversData[key],
            latitude: driversData[key].lat,
            longitude: driversData[key].lng,
          }))
          .filter((driver) => {
            const distance = getDistanceInMiles(
              userLatitude,
              userLongitude,
              driver.lat,
              driver.lng
            );
            return distance <= 10; // 10 miles straight-line radius (pre-filter)
          });

        const driversWithTimeAndPrice = await calculateDriverTimes({
          markers: driversList,
          userLatitude,
          userLongitude,
          destinationLatitude,
          destinationLongitude,
        });

        // Post-filter to ensure we respect a maximum wait time of 25 minutes
        const validDrivers = (driversWithTimeAndPrice || []).filter(
          (d) => d && d.pickupTime <= 25
        );

        setDrivers(validDrivers);
      })
      .catch((error) => {
        console.error("Error fetching drivers in ConfirmRide:", error);
      })
      .finally(() => {
        setLoading(false);
      });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLatitude, userLongitude, destinationLatitude, destinationLongitude, driversFetchTrigger]);
  
    const renderContent = () => {
      if (loading) {
        return (
          <View className="flex-1 justify-center items-center h-96">
            <ActivityIndicator size="large" color="#2B9DD9" />
            <Text className="mt-4 text-lg">{t("confirmRide.searchingDrivers")}</Text>
          </View>
        );
      }
  
      if (drivers?.length === 0) {
        return (
          <View className="flex-1 justify-center items-center h-96">
            <Text className="py-10 text-lg text-center text-gray-500">
              {t("confirmRide.noDrivers")}
            </Text>
          </View>
        );
      }
  
      return (
        <View>
          {drivers.map((item) => (
            <DriverCard
              key={item.id} // Add key here
              id={item.id}
              firstName={item.driverName}
              lastName={item.last_name}
              profileImageUrl={item.profilePhoto}
              carImageUrl={item.car_image_url}
              carSeats={item.seatsAvailable}
              rating={item.rating}
              time={item.pickupTime} // Use pickupTime here
              price={item.price}
              priceWithCard={item.priceWithCard}
              paymentMethod={paymentMethod}
              selected={selectedDriver?.id === item.id}
              onConfirm={() => {
                setSelectedDriver(item); // Set the driver first
                setActiveSheet("bookRide"); // Then change the sheet
              }}
            />
          ))}
        </View>
      );
    };


  return (
    <View className='pb-4'>

    <View>
      {renderContent()}
    </View>
    </View>
  )
}