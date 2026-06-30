import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { formatTime } from "../lib/utils";
import AntDesign from "@expo/vector-icons/AntDesign";
import Foundation from "@expo/vector-icons/Foundation";
import CustomButton from "./CustomButton";
import { useTranslation } from "../hooks/useTranslation";

export default function DriverCard(props) {
  const {
    id,
    firstName,
    lastName,
    profileImageUrl,
    carImageUrl,
    carSeats,
    rating,
    time,
    price,
    priceWithCard,
    paymentMethod,
    selected,
    setSelected,
    onConfirm,
  } = props;
  const { t } = useTranslation("rideCard");

  const displayPrice = paymentMethod === 'cash' ? price : priceWithCard;

  return (
    <TouchableOpacity
      className={`${
        selected ? "bg-secondary/20" : "bg-white"
      } flex flex-row items-center gap-2 py-5 justify-between rounded-xl mb-4`}
    >
      <Image
        source={{ uri: profileImageUrl }}
        className="w-14 h-14 rounded-full"
      />
<View>

        <View className="flex flex-row items-center justify-between mb-1">
          <Text className="text-lg">
            {firstName} {lastName}
          </Text>

        </View>
      <View className="flex-1 flex flex-col items-start justify-center ">

        <View className="flex flex-row items-center justify-start">
          {/* <View className="flex flex-row items-center space-x-1 ml-2">
            <AntDesign name="star" size={14} color="#FFD700" />
            <Text className="text-sm">{rating}</Text>
          </View>
          <View className="flex flex-row items-center">
            <Foundation name="dollar" size={24} color="#2B9DD9" />
            <Text className="text-sm ml-1"></Text>
          </View>

          <Text className="text-sm text-gray-500 mx-1">|</Text>

          {time ? (
            <Text className="text-sm text-gray-500">{formatTime(parseInt(time))}</Text>
          ) : (
            <Text className="text-sm text-gray-500">... min</Text>
          )}

          <Text className="text-sm text-gray-500 mx-1">|</Text>

          <Text className="text-sm text-gray-500">{carSeats} seats</Text> */}
          {/* <View>
          <Text className="text-2xl font-semibold text-green-600">$
{`${displayPrice}`}
          </Text>
        </View> */}
           
        </View>
      </View>

<View className=""  >
          <Text className="text-2xl font-semibold text-green-600">$
{`${displayPrice?.toFixed(2)}`}
          </Text>
        </View>
</View>
     <View style={{ width: 100 }}>
          <CustomButton title={t("select")} onPress={onConfirm} textClassName="text-xs" />
        </View>

        {/* <View style={{ width: 100 }}>
          <CustomButton title="Select" onPress={onConfirm} textClassName="text-xs" />
        </View> */}

        
      
    </TouchableOpacity>
  );
}
