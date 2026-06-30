import React from 'react'
import { useLocationStore } from '../../store';
import GoogleTextInput from '../GoogleTextInput';
import { Image, Text, View } from 'react-native';
import CustomButton from '../CustomButton';
import { useTranslation } from '../../hooks/useTranslation';
import Toast from 'react-native-toast-message';
import { isWithinOperationalZone } from '../../utils/geofence';

export default function FindRideComponent(props) {
    const { setActiveSheet } = props;
    const { t } = useTranslation("ride");
   
      const {
        userAddress,
        userLatitude,
        userLongitude,
        destinationAddress,
        destinationLatitude,
        destinationLongitude,
        setDestinationLocation,
        setUserLocation, 
        clearDestinationLocation,
      } = useLocationStore();
  return (
    <View className='pb-4'>
    
    <View className="flex-row items-center">
      <View className="">

    <Image
            source={require("../../assets/dots.png")}
            className="w-6 h-24"
            resizeMode="contain"
          />
      </View>
          <View className="flex-1 ">

    <View className="my-1 shrink z-20">
         
         <GoogleTextInput
           
           initialLocation={userAddress}
           containerStyle="bg-neutral-100"
           textInputBackgroundColor="#f5f5f5"
           handlePress={(location) => setUserLocation(location)}
         />
       </View>
       <View className="my-1 shrink z-10">
        
         <GoogleTextInput
           
           initialLocation={destinationAddress}
           containerStyle="bg-neutral-100"
           textInputBackgroundColor="transparent"
           handlePress={(location) => setDestinationLocation(location)}
         />
       </View>
          </View>

    </View>
       {!userAddress || !destinationAddress ? (
         <View className="mt-5  opacity-50">
           <CustomButton title={t("findRide.findNowDisabled")} />
         </View>
       ) : (
         <CustomButton
           title={t("findRide.findNow")}
           onPress={() => {
             // Final strict geofence validation before requesting ride
             if (!isWithinOperationalZone(userLatitude, userLongitude)) {
                Toast.show({
                  type: 'error',
                  text1: t("messages.outOfZoneTitle") || "Out of Service Area",
                  text2: t("messages.originOutOfZoneDetail") || "We don't cover your pickup location yet."
                });
                return;
             }

             if (!isWithinOperationalZone(destinationLatitude, destinationLongitude)) {
                Toast.show({
                  type: 'error',
                  text1: t("messages.outOfZoneTitle") || "Out of Service Area",
                  text2: t("messages.destinationOutOfZoneDetail") || "Your destination is out of our coverage area."
                });
                return;
             }

             setActiveSheet("paymentOptions");
           }}
         />
       )}
    </View>
  )
}
