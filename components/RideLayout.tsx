import React, { useRef } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTranslation } from "../hooks/useTranslation";
import { useRouter } from "expo-router";

import BottomSheet, {
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { Image } from "react-native";
import Map from "./Map";
import { Driver } from "../types";

interface RideLayoutProps {
  children: React.ReactNode;
  title?: string;
  snapPoints?: string[];
  list?: boolean;
  driver: Driver | null;
  isRiding: boolean;
}

export default function RideLayout({
  children,
  title,
  snapPoints,
  driver,
  isRiding,
}: RideLayoutProps) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const bottomSheetRef = useRef<BottomSheet>(null);

  return (
    <GestureHandlerRootView className="flex-1 bg-bg min-h-screen">
      <View className="flex-1 bg-white">
        <View className="flex flex-col h-screen bg-blue-500">
          <View className="flex flex-row absolute bg-white/60 w-full z-10 top-16 items-center justify-between px-5">
            <View className="flex-row items-center">
              {isRiding ? (
                <TouchableOpacity onPress={() => router.replace("/(tabs)/home")}>
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                    <Ionicons name="arrow-back-outline" size={24} color="black" />
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => router.back()}>
                  <View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                    <Ionicons name="arrow-back-outline" size={24} color="black" />
                  </View>
                </TouchableOpacity>
              )}
              <Text className="text-xl font-bold ml-5">{title || t("navigation.goBack")}</Text>
            </View>
            
            <View className="h-20 w-20 "> 
              <Image
                source={{
                  uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/IMG-Auth-logo.png?alt=media&token=ee94ae9c-8c7f-482b-885d-c0213455e06a`,
                }}
                className="h-full w-full"
              />
            </View>
          </View>
          <Map driver={driver} isRiding={isRiding} />
        </View>
        <BottomSheet
          keyboardBehavior="extend"
          ref={bottomSheetRef}
          snapPoints={snapPoints || ["40%", "85%"]}
          index={0}
        >
          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
    </GestureHandlerRootView>
  );
}