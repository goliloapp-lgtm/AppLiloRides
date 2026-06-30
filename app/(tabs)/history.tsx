import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import RecentRidesList from '../../components/RecentRidesList';
import { useTranslation } from '../../hooks/useTranslation';

export default function RecentRides() {
  const { t } = useTranslation("history");

  return (
    <>
      <View className="flex-row bg-secondary pt-12 items-center justify-start ">
        <View className="h-14 w-14 rounded-lg">
          <Image
            source={{
              uri: `https://firebasestorage.googleapis.com/v0/b/lilo-23fef.firebasestorage.app/o/IMG-Auth-logo-white.png?alt=media&token=b7a62226-856a-4ef0-9924-758576334bf5`,
            }}
            className="h-full w-full"
          />
        </View>
        <Text className="text-white font-bold text-lg">{t("header")}</Text>
      </View>
      <ScrollView className="flex-1 bg-gray-100" contentContainerStyle={{ paddingBottom: 100 }}>
        <View className="bg-gray-100 px-6">
          <View className="flex-row items-center justify-between mb-2" />
          <RecentRidesList />
        </View>
      </ScrollView>
    </>
  );
}
