import { View, Text } from "react-native";
import React from "react";
import Map from "./Map";
import { useTranslation } from "../hooks/useTranslation";

export default function CurrentLocationMap() {
  const { t } = useTranslation("home");
  
  return (
    <View> 
      <Text className="text-black text-xl font-semibold mb-5">
        {t("currentLocation")}
      </Text>
      <View className="h-[450px] flex flex-row items-center bg-transparent mb-5 ">
        <Map />
      </View>
    </View>
  );
}
