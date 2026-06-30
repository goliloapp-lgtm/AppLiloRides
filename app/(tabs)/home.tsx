import React, { useEffect, useLayoutEffect, useState } from "react";
import * as Location from "expo-location";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../firebase-config";
import CurrentLocationMap from "../../components/CurrentLocationMap";
import RecentRidesList from "../../components/RecentRidesList";
import { useLocationStore, useRideStore } from "../../store";
import { useAuth } from "../../lib/context/AuthContext";
import { useTranslation } from "../../hooks/useTranslation";
import { Ionicons } from "@expo/vector-icons";
import GoogleTextInput from "../../components/GoogleTextInput";
import { useIsFocused } from "@react-navigation/native";
import { useRouter } from "expo-router";

export default function Home() {
  const router = useRouter();
  const { setUserLocation, setDestinationLocation, destinationAddress } = useLocationStore();
  const { activeRide } = useRideStore();
  const [userInfo, setUserInfo] = useState<any>(null);
  const { t } = useTranslation("home");
  const { user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      const requestLocation = async () => {
        let { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status !== "granted") {
          return;
        }

        let location = await Location.getCurrentPositionAsync({});

        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const addrParts = [
          address[0]?.streetNumber,
          address[0]?.street,
          address[0]?.district ?? address[0]?.subregion,
          address[0]?.city,
          address[0]?.region,
        ].filter(Boolean);

        const fullAddress = addrParts.length > 0 ? addrParts.join(', ') : 'Current Location';

        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          address: fullAddress,
        });
      };

      requestLocation();
    }
  }, [isFocused]);

  useEffect(() => {
    if (user && user.uid) {
      const getUserInfo = async () => {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            setUserInfo(userDocSnap.data());
          } else {
            console.log("No such user document!");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      };
      getUserInfo();
    }
  }, [user]);

  const handleDestinationPress = (location: any) => {
    setDestinationLocation(location);
    if (location.latitude && location.longitude) {
      router.push("/find-ride");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={80}
    >
      <View className="flex-row bg-secondary items-center justify-start pt-12 ">
        <View className="h-14 w-14 rounded-lg">
          <Image
            source={{
              uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/IMG-Auth-logo-white.png?alt=media&token=b7a62226-856a-4ef0-9924-758576334bf5`,
            }}
            className="h-full w-full"
          />
        </View>
        <Text className="text-white font-bold text-lg">{t("title")}</Text>
      </View>
      <View className="bg-gray-100 px-3 flex-1">
        <FlatList
          keyboardShouldPersistTaps="always"
          data={[]}
          keyExtractor={() => "dummy"}
          renderItem={() => null}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <>
              <View className="flex-row items-center justify-between max-w-full my-5">
                <Text className="text-black text-xl font-bold mr-2">
                  {t("greeting", { 
                    name: (!userInfo?.firstName && !userInfo?.lastName) 
                      ? user?.displayName || "" 
                      : `${userInfo?.firstName} ${userInfo.lastName}` 
                  })}
                </Text>
              </View>
              {activeRide ? (
                <TouchableOpacity
                  onPress={() => router.push("/find-ride")}
                  className="bg-gray-800 p-4 rounded-full items-center justify-center mb-4"
                >
                  <Text className="text-white font-bold text-lg">
                    {t("viewActiveRide")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <GoogleTextInput 
                  key={destinationAddress || "empty"}
                  initialLocation={destinationAddress}
                  handlePress={handleDestinationPress} 
                  icon={"search"}
                  placeholder={t("destinationPlaceholder")}
                />
              )}
              <CurrentLocationMap />
              <TouchableOpacity 
                onPress={() => setShowHistory(!showHistory)}
                className="flex-row items-center justify-between bg-white p-4 rounded-xl shadow-sm mb-5"
              >
                <Text className="text-black text-xl font-semibold">
                  {t("recentRides")}
                </Text>
                <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={24} color="black" />
              </TouchableOpacity>
              {showHistory && <RecentRidesList />}
            </>
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}
