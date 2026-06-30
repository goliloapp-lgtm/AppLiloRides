import React from "react";
import { View, Text, Image } from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import moment from "moment";
import { useTranslation } from "../hooks/useTranslation";

export interface Ride {
  ride_id: string;
  destination_longitude: number | string;
  destination_latitude: number | string;
  origin_address: string;
  destination_address: string;
  created_at: string | Date | null;
  ride_time: number | string | Date | null;
  payment_status: string;
  status?: string;
  driver: {
    driver_id: string;
    first_name: string;
    last_name: string;
    car_seats: number;
    profile_image_url?: string;
    car_image_url?: string;
    rating?: string | number;
  } | null;
}

interface RideCardProps {
  ride: Ride;
}

export default function RideCard({ ride }: RideCardProps) {
  const { t } = useTranslation("rideCard");
  const {
    destination_longitude,
    destination_latitude,
    origin_address,
    destination_address,
    created_at,
    ride_time,
    driver,
    payment_status,
    status,
  } = ride;

  // Format ride time. It can be a Date (returned by some APIs) or number of minutes
  let formattedDuration = "0min";
  if (ride_time) {
    if (typeof ride_time === "number") {
      formattedDuration = `${Math.round(ride_time)}min`;
    } else if (typeof ride_time === "string") {
      const parsed = parseInt(ride_time, 10);
      formattedDuration = isNaN(parsed) ? ride_time : `${parsed}min`;
    } else if (ride_time instanceof Date) {
      formattedDuration = `${ride_time.getMinutes()}min`;
    }
  }

  const formattedDate = created_at 
    ? moment(created_at).format("MMMM Do YYYY") 
    : "";

  return (
    <View className="w-full bg-white rounded-xl shadow-sm border border-neutral-100 p-4 mb-3">
      {/* Upper section: Map image and addresses */}
      <View className="flex-row items-center w-full">
        <Image
          source={{
            uri: `https://maps.geoapify.com/v1/staticmap?style=osm-bright&width=600&height=400&center=lonlat:${destination_longitude},${destination_latitude}&zoom=14&apiKey=${process.env.EXPO_PUBLIC_GEOAPIFY_API_KEY}`,
          }}
          className="w-20 h-20 rounded-lg"
        />
        
        {/* Address texts: Occupies all remaining horizontal space */}
        <View className="flex-1 ml-4 justify-center">
          <View className="flex-row items-center mb-2 pr-1">
            <View className="w-5 items-center">
              <FontAwesome5 name="location-arrow" size={13} color="#9CA3AF" />
            </View>
            <Text className="text-sm text-neutral-600 flex-1 ml-2" numberOfLines={1}>
              {origin_address}
            </Text>
          </View>
          
          <View className="flex-row items-center pr-1">
            <View className="w-5 items-center">
              <FontAwesome5 name="map-marker-alt" size={14} color="#EF4444" />
            </View>
            <Text className="text-sm text-neutral-600 flex-1 ml-2" numberOfLines={1}>
              {destination_address}
            </Text>
          </View>
        </View>
      </View>

      {/* Details Box */}
      <View className="w-full mt-4 bg-neutral-50 rounded-xl p-3">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm text-neutral-500">{t("dateTime")}</Text>
          <Text className="text-sm font-semibold text-neutral-800">
            {formattedDate ? `${formattedDate}, ` : ""}{formattedDuration}
          </Text>
        </View>
        
        {driver && (
          <>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm text-neutral-500">{t("driver")}</Text>
              <Text className="text-sm font-semibold text-neutral-800">
                {driver.first_name} {driver.last_name}
              </Text>
            </View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-sm text-neutral-500">{t("carSeats")}</Text>
              <Text className="text-sm font-semibold text-neutral-800">{driver.car_seats}</Text>
            </View>
          </>
        )}
        
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-neutral-500">{t("tripStatus")}</Text>
          <Text
            className={`text-sm font-bold capitalize ${
              status === "cancelled" ? "text-red-500" : "text-green-600"
            }`}
          >
            {status === "cancelled" ? t("cancelled") : t("completed")}
          </Text>
        </View>
      </View>
    </View>
  );
}
