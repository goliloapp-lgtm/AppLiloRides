import { View, Text, Image } from 'react-native'
import React, { useEffect } from 'react'
import { useDriverStore, useLocationStore, usePaymentStore, useRideStore } from '../../store';
import { useAuth } from '../../lib/context/AuthContext';
import { AntDesign, Entypo, Feather } from '@expo/vector-icons';
import PaymentButton from '../PaymentButton';
import { formatTime } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';
import { get, ref } from 'firebase/database';
import { rtdb } from '../../firebase-config';

export default function BookRideComponent(props) {
    const { setActiveSheet, navigation } = props;
    const { userAddress, destinationAddress } = useLocationStore();
      const { selectedDriver, setSelectedDriver } = useDriverStore();
      const { paymentMethod } = usePaymentStore();
      const { user } = useAuth();
      const { t } = useTranslation("ride");
      const { activeRide } = useRideStore();

      useEffect(() => {
        if (selectedDriver && typeof selectedDriver === 'string') {
          const driverRef = ref(rtdb, `conductores_activos/${selectedDriver}`);
          get(driverRef).then((snapshot) => {
            if (snapshot.exists()) {
              const val = snapshot.val();
              const fare = activeRide ? activeRide.farePriceCents / 100 : 0;
              const eta = activeRide ? activeRide.etaMinutes : 5;
              setSelectedDriver({
                id: selectedDriver,
                ...val,
                price: fare,
                priceWithCard: fare,
                pickupTime: eta,
              });
            }
          }).catch((err) => {
            console.error("Error restoring selected driver details:", err);
          });
        }
      }, [selectedDriver, activeRide, setSelectedDriver]);

      const driverDetails = selectedDriver;
      const actualDriverId = typeof selectedDriver === 'object' ? selectedDriver?.id : selectedDriver;
    
    
      const displayPrice = driverDetails && typeof driverDetails === 'object'
        ? (paymentMethod !== 'cash' ? driverDetails?.priceWithCard : driverDetails?.price)
        : null;
  return (
    <View className='pb-4'>
          {/* <Text className="text-xl font-bold mb-3">Ride Information</Text> */}

<View className="w-full bg-white rounded-3xl p-5 shadow">

          <View className="flex flex-col w-full items-center justify-center mt-10">
            <Image 
              source={{ uri: driverDetails?.profilePhoto }}
              className="w-28 h-28 rounded-full"
            />

            <View className="flex flex-row items-center justify-center mt-5 space-x-2">
              <Text className="text-lg font-bold">
                {driverDetails?.driverName}
              </Text>

              <View className="flex flex-row items-center space-x-0.5">
                <AntDesign name="star" size={14} color="#FFD700" />
                <Text className="text-lg font-bold">
                  {driverDetails?.rating || "5.0"}
                </Text>
              </View>
            </View>
          </View>
  {paymentMethod ? (
             <PaymentButton
               paymentMethod={paymentMethod}
               fullName={user?.displayName}
               email={user?.email}
               amount={displayPrice}
               driverId={actualDriverId}
               rideTime={typeof driverDetails === 'object' ? driverDetails?.time : null}
               setActiveSheet={setActiveSheet}
               navigation={navigation}
             />
           ) : (
             <View className="my-10 items-center">
               <Text className="text-md text-red-500">{t("bookRide.noPaymentMethod")}</Text>
             </View>
           )}
          <View className="flex flex-col w-full items-start justify-center py-3 px-5 rounded-3xl  mt-5">
            <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
              <Text className="text-lg ">{t("bookRide.ridePrice")}</Text>
              <Text className="text-lg font-bold text-[#0CC25F]">
                ${displayPrice?.toFixed(2) || "15"}
              </Text>
            </View>

            <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
              <Text className="text-lg ">{t("bookRide.pickupTime")}</Text>
              <Text className="text-lg ">
                {formatTime(parseInt(driverDetails?.pickupTime) || 5)}
              </Text>
            </View>

            <View className="flex flex-row items-center justify-between w-full border-b border-white py-3">
              <Text className="text-lg ">{t("bookRide.carModel")}</Text>
              <Text className="text-lg ">
                {driverDetails?.vehicleBrand} {driverDetails?.vehicleModel}
              </Text>
            </View>

            <View className="flex flex-row items-center justify-between w-full py-3">
              <Text className="text-lg ">{t("bookRide.carSeats")}</Text>
              <Text className="text-lg ">{driverDetails?.seatsAvailable}</Text>
            </View>
          </View>
</View>

<View className="w-full bg-white rounded-3xl p-5 shadow mt-5">
          <View className="flex-row items-center">
 <Image
            source={require("../../assets/dots.png")}
            className="w-6 h-20"
            resizeMode="contain"
          />
          <View className="flex flex-col w-full items-start justify-center ">
            
            <View className="flex flex-row items-center justify-start mt-3 border-t border-b border-gray-200 w-full py-3">

              <Text className="text-lg  ml-2">{userAddress}</Text>
            </View>

            <View className="flex flex-row items-center justify-start border-b border-gray-200 w-full py-3">
         
              <Text className="text-lg  ml-2">{destinationAddress}</Text>
            </View>

          </View>
          </View>

          </View>
        
    </View>
     );
 }