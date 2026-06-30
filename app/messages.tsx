import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  Image,
  ScrollView,
} from "react-native";
import { useTranslation } from "../hooks/useTranslation";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Messages() {
  const { t } = useTranslation("messages");

  return (
    <SafeAreaView className="flex-1">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="bg-bg px-6 min-h-screen pb-14">
            <View className="flex-row items-center justify-between mt-12 mb-5">
              <Text className="text-black text-2xl font-bold">{t("title")}</Text>
            </View>
            <View className="flex-1 items-center justify-center ">
              <Image
                source={require("../assets/icons/message.png")}
                style={{ width: 264, height: 115, resizeMode: "contain" }}
              />
              <Text className="font-bold text-2xl text-black mt-5">
                {t("noMessages")}
              </Text>
              <Text className=" text-lg text-gray-500">
                {t("noMessagesDescription")}
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
